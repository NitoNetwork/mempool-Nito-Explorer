import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, catchError, defer, filter, from, mergeMap, of, retry, shareReplay, switchMap, take, takeUntil, tap, throwError, timer } from 'rxjs';
import { Transaction, Address, Outspend, Recent, Asset, ScriptHash, AddressTxSummary, Utxo } from '@interfaces/electrs.interface';
import { StateService } from '@app/services/state.service';
import { BlockExtended } from '@interfaces/node-api.interface';
import { calcScriptHash$ } from '@app/bitcoin.utils';

@Injectable({
  providedIn: 'root'
})
export class ElectrsApiService {
  private apiBaseUrl: string; // base URL is protocol, hostname, and port
  private apiBasePath: string; // network path is /testnet, etc. or '' for mainnet

  private requestCache = new Map<string, { subject: BehaviorSubject<any>, expiry: number }>;
  private publicCache = new Map<string, { value: Observable<any>; expiry: number }>();
  private latestTip = '';
  private cacheGeneration = 0;
  private cacheInvalidated$ = new Subject<void>();
  private connectionAvailable = true;
  private backendAvailable = true;

  constructor(
    private httpClient: HttpClient,
    private stateService: StateService,
  ) {
    this.apiBaseUrl = ''; // use relative URL by default
    if (!stateService.isBrowser) { // except when inside AU SSR process
      this.apiBaseUrl = this.stateService.env.NGINX_PROTOCOL + '://' + this.stateService.env.NGINX_HOSTNAME + ':' + this.stateService.env.NGINX_PORT;
    }
    this.apiBasePath = ''; // assume mainnet by default
    this.stateService.networkChanged$.subscribe((network) => {
      this.invalidateCaches(); this.latestTip = '';
      this.apiBasePath = network && network !== this.stateService.env.ROOT_NETWORK ? '/' + network : '';
    });
    (this.stateService.blocksSubject$ ?? this.stateService.blocks$).subscribe(blocks => {
      const tip = blocks[0]?.id ?? '';
      if (tip !== this.latestTip) { this.invalidateCaches(); this.latestTip = tip; }
    });
    this.stateService.connectionState$.subscribe(state => {
      this.connectionAvailable = state === 2;
      if (!this.connectionAvailable) { this.invalidateCaches(); }
    });
    this.stateService.nitoStatus$.subscribe(status => {
      this.backendAvailable = status?.available !== false;
      if (!this.backendAvailable) { this.invalidateCaches(); }
    });
  }

  private invalidateCaches(): void {
    this.cacheGeneration++;
    this.publicCache.clear(); this.requestCache.clear();
    this.cacheInvalidated$.next();
  }

  private scopedRequest<T>(generation: number, load: () => Observable<T>, retryTransition = true): Observable<T> {
    return defer(() => {
      if (generation !== this.cacheGeneration || !this.connectionAvailable || !this.backendAvailable) {
        return throwError(() => new Error('Chain snapshot unavailable or changed; retry'));
      }
      return load().pipe(
        // A block transition briefly fences server reads; retry that response only.
        retry({ count: retryTransition ? 2 : 0, delay: error => error?.status === 503 ? timer(1000) : throwError(() => error) }),
        takeUntil(this.cacheInvalidated$.pipe(mergeMap(() => throwError(() => new Error('Chain snapshot changed; retry'))))),
        tap(() => {
          if (generation !== this.cacheGeneration) { throw new Error('Chain snapshot changed; retry'); }
        }),
      );
    });
  }

  private publicRequest<T>(path: string, load: () => Observable<T>): Observable<T> {
    const key = this.apiBasePath + path;
    const generation = this.cacheGeneration;
    const cached = this.publicCache.get(key);
    if (cached && cached.expiry > Date.now()) { return this.scopedRequest(generation, () => cached.value, false); }
    const entry = { value: null as Observable<T>, expiry: Infinity };
    entry.value = this.scopedRequest(generation, load).pipe(tap((value: any) => {
      entry.expiry = Date.now() + (value?.status?.confirmed || path.startsWith('/api/block') ? 30000 : 2000);
    }), catchError(error => {
      if (this.publicCache.get(key) === entry) { this.publicCache.delete(key); }
      return throwError(() => error);
    }), shareReplay({ bufferSize: 1, refCount: false }));
    this.publicCache.delete(key); this.publicCache.set(key, entry);
    while (this.publicCache.size > 256) { this.publicCache.delete(this.publicCache.keys().next().value); }
    return this.scopedRequest(generation, () => entry.value, false);
  }

  private generateCacheKey(functionName: string, params: any[]): string {
    return this.apiBasePath + ':' + functionName + JSON.stringify(params);
  }

  // delete expired cache entries
  private cleanExpiredCache(): void {
    this.requestCache.forEach((value, key) => {
      if (value.expiry < Date.now()) {
        this.requestCache.delete(key);
      }
    });
  }

  cachedRequest<T, F extends (...args: any[]) => Observable<T>>(
    apiFunction: F,
    expireAfter: number, // in ms
    ...params: Parameters<F>
  ): Observable<T> {
    this.cleanExpiredCache();

    const cacheKey = this.generateCacheKey(apiFunction.name, params);
    const generation = this.cacheGeneration;
    let entry = this.requestCache.get(cacheKey);
    if (!entry) {
      const subject = new BehaviorSubject<T | null>(null);
      entry = { subject, expiry: Date.now() + expireAfter };
      this.requestCache.set(cacheKey, entry);
      while (this.requestCache.size > 256) { this.requestCache.delete(this.requestCache.keys().next().value); }

      // Construct the HTTP observable now so its network URL cannot change later.
      const request = apiFunction.bind(this)(...params);
      this.scopedRequest(generation, () => request).pipe(
        tap(data => {
          subject.next(data as T);
        }),
        catchError((error) => {
          if (this.requestCache.get(cacheKey) === entry) { this.requestCache.delete(cacheKey); }
          subject.error(error);
          return of(null);
        }),
        shareReplay(1),
      ).subscribe();
    }

    return this.scopedRequest(generation, () => entry.subject.asObservable().pipe(filter(val => val !== null), take(1)), false);
  }

  getBlock$(hash: string): Observable<BlockExtended> {
    const path = '/api/block/' + hash;
    const url = this.apiBaseUrl + this.apiBasePath + path;
    return this.publicRequest(path, () => this.httpClient.get<BlockExtended>(url));
  }

  listBlocks$(height?: number): Observable<BlockExtended[]> {
    return this.httpClient.get<BlockExtended[]>(this.apiBaseUrl + this.apiBasePath + '/api/blocks/' + (height || ''));
  }

  getTransaction$(txId: string, refresh = false): Observable<Transaction> {
    const path = '/api/tx/' + txId;
    // Drop a completed response after a proven reorg, while concurrent refreshes
    // still share the new in-flight request. Canonical-tip changes fence older requests.
    if (refresh && this.publicCache.get(this.apiBasePath + path)?.expiry !== Infinity) {
      this.publicCache.delete(this.apiBasePath + path);
    }
    const url = this.apiBaseUrl + this.apiBasePath + path;
    return this.publicRequest(path, () => this.httpClient.get<Transaction>(url));
  }

  getTransactionHex$(txId: string): Observable<string> {
    return this.httpClient.get(this.apiBaseUrl + this.apiBasePath + '/api/tx/' + txId + '/hex', { responseType: 'text' });
  }

  getRecentTransaction$(): Observable<Recent[]> {
    return this.httpClient.get<Recent[]>(this.apiBaseUrl + this.apiBasePath + '/api/mempool/recent');
  }

  getOutspend$(hash: string, vout: number): Observable<Outspend> {
    return this.httpClient.get<Outspend>(this.apiBaseUrl + this.apiBasePath + '/api/tx/' + hash + '/outspend/' + vout);
  }

  getOutspends$(hash: string): Observable<Outspend[]> {
    const path = '/api/tx/' + hash + '/outspends';
    const url = this.apiBaseUrl + this.apiBasePath + path;
    return this.publicRequest(path, () => this.httpClient.get<Outspend[]>(url));
  }

  getOutspendsBatched$(txids: string[]): Observable<Outspend[][]> {
    let params = new HttpParams();
    params = params.append('txids', txids.join(','));
    return this.httpClient.get<Outspend[][]>(this.apiBaseUrl + this.apiBasePath + '/api/txs/outspends', { params });
  }

  getBlockTransactions$(hash: string, index: number = 0): Observable<Transaction[]> {
    const path = '/api/block/' + hash + '/txs/' + index;
    const url = this.apiBaseUrl + this.apiBasePath + path;
    return this.publicRequest(path, () => this.httpClient.get<Transaction[]>(url));
  }

  getBlockHashFromHeight$(height: number): Observable<string> {
    return this.httpClient.get(this.apiBaseUrl + this.apiBasePath + '/api/block-height/' + height, {responseType: 'text'});
  }

  getBlockTxId$(hash: string, index: number): Observable<string> {
    return this.httpClient.get(this.apiBaseUrl + this.apiBasePath + '/api/block/' + hash + '/txid/' + index, { responseType: 'text' });
  }

  getAddress$(address: string): Observable<Address> {
    return this.httpClient.get<Address>(this.apiBaseUrl + this.apiBasePath + '/api/address/' + address);
  }

  getPubKeyAddress$(pubkey: string): Observable<Address> {
    const scriptpubkey = (pubkey.length === 130 ? '41' : '21') + pubkey + 'ac';
    return this.getScriptHash$(scriptpubkey).pipe(
      switchMap((scripthash: ScriptHash) => {
        return of({
          ...scripthash,
          address: pubkey,
          is_pubkey: true,
        });
      })
    );
  }

  getScriptHash$(script: string): Observable<ScriptHash> {
    return from(calcScriptHash$(script)).pipe(
      switchMap(scriptHash => this.httpClient.get<ScriptHash>(this.apiBaseUrl + this.apiBasePath + '/api/scripthash/' + scriptHash))
    );
  }

  getAddressTransactions$(address: string,  txid?: string): Observable<Transaction[]> {
    let params = new HttpParams();
    if (txid) {
      params = params.append('after_txid', txid);
    }
    return this.httpClient.get<Transaction[]>(this.apiBaseUrl + this.apiBasePath + '/api/address/' + address + '/txs', { params });
  }

  getAddressesTransactions$(addresses: string[], txid?: string): Observable<Transaction[]> {
    let params = new HttpParams();
    if (txid) {
      params = params.append('after_txid', txid);
    }
    return this.httpClient.post<Transaction[]>(
      this.apiBaseUrl + this.apiBasePath + '/api/addresses/txs',
      addresses,
      { params }
    );
  }

  getAddressSummary$(address: string,  txid?: string): Observable<AddressTxSummary[]> {
    let params = new HttpParams();
    if (txid) {
      params = params.append('after_txid', txid);
    }
    return this.httpClient.get<AddressTxSummary[]>(this.apiBaseUrl + this.apiBasePath + '/api/address/' + address + '/txs/summary', { params });
  }

  getAddressesSummary$(addresses: string[],  txid?: string): Observable<AddressTxSummary[]> {
    let params = new HttpParams();
    if (txid) {
      params = params.append('after_txid', txid);
    }
    return this.httpClient.post<AddressTxSummary[]>(this.apiBaseUrl + this.apiBasePath + '/api/addresses/txs/summary', addresses, { params });
  }

  getScriptHashTransactions$(script: string,  txid?: string): Observable<Transaction[]> {
    let params = new HttpParams();
    if (txid) {
      params = params.append('after_txid', txid);
    }
    return from(calcScriptHash$(script)).pipe(
      switchMap(scriptHash => this.httpClient.get<Transaction[]>(this.apiBaseUrl + this.apiBasePath + '/api/scripthash/' + scriptHash + '/txs', { params })),
    );
  }

  getScriptHashesTransactions$(scripts: string[],  txid?: string): Observable<Transaction[]> {
    let params = new HttpParams();
    if (txid) {
      params = params.append('after_txid', txid);
    }
    return from(Promise.all(scripts.map(script => calcScriptHash$(script)))).pipe(
      switchMap(scriptHashes => this.httpClient.post<Transaction[]>(this.apiBaseUrl + this.apiBasePath + '/api/scripthashes/txs', scriptHashes, { params })),
    );
  }

  getScriptHashSummary$(script: string,  txid?: string): Observable<AddressTxSummary[]> {
    let params = new HttpParams();
    if (txid) {
      params = params.append('after_txid', txid);
    }
    return from(calcScriptHash$(script)).pipe(
      switchMap(scriptHash => this.httpClient.get<AddressTxSummary[]>(this.apiBaseUrl + this.apiBasePath + '/api/scripthash/' + scriptHash + '/txs/summary', { params })),
    );
  }

  getAddressUtxos$(address: string): Observable<Utxo[]> {
    return this.httpClient.get<Utxo[]>(this.apiBaseUrl + this.apiBasePath + '/api/address/' + address + '/utxo');
  }

  getScriptHashUtxos$(script: string): Observable<Utxo[]> {
    return from(calcScriptHash$(script)).pipe(
      switchMap(scriptHash => this.httpClient.get<Utxo[]>(this.apiBaseUrl + this.apiBasePath + '/api/scripthash/' + scriptHash + '/utxo')),
    );
  }

  getScriptHashesSummary$(scripts: string[],  txid?: string): Observable<AddressTxSummary[]> {
    let params = new HttpParams();
    if (txid) {
      params = params.append('after_txid', txid);
    }
    return from(Promise.all(scripts.map(script => calcScriptHash$(script)))).pipe(
      switchMap(scriptHashes => this.httpClient.post<AddressTxSummary[]>(this.apiBaseUrl + this.apiBasePath + '/api/scripthashes/txs/summary', scriptHashes, { params })),
    );
  }

  getAsset$(assetId: string): Observable<Asset> {
    return this.httpClient.get<Asset>(this.apiBaseUrl + this.apiBasePath + '/api/asset/' + assetId);
  }

  getAssetTransactions$(assetId: string): Observable<Transaction[]> {
    return this.httpClient.get<Transaction[]>(this.apiBaseUrl + this.apiBasePath + '/api/asset/' + assetId + '/txs');
  }

  getAssetTransactionsFromHash$(assetId: string, txid: string): Observable<Transaction[]> {
    return this.httpClient.get<Transaction[]>(this.apiBaseUrl + this.apiBasePath + '/api/asset/' + assetId + '/txs/chain/' + txid);
  }

  getAddressesByPrefix$(prefix: string): Observable<string[]> {
    if (prefix.toLowerCase().indexOf('bc1') === 0) {
      prefix = prefix.toLowerCase();
    }
    return this.httpClient.get<string[]>(this.apiBaseUrl + this.apiBasePath + '/api/address-prefix/' + prefix);
  }
}
