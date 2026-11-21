import { money, Nitoshi } from '@app/shared/nito-money';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, HostListener, Inject, Input, LOCALE_ID, OnDestroy, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { combineLatest, map, Observable, startWith, Subscription } from 'rxjs';
import { StateService } from '@app/services/state.service';
import { WalletStats } from '../../../shared/wallet-stats';
import { AddressTxSummary } from '../../../interfaces/electrs.interface';
import { Treasury } from '../../../interfaces/node-api.interface';


interface SupplyShare {
  share: number;
  btc: Nitoshi;
  x: string;
  w: string;
  label: string;
  type: string;
}

@Component({
  selector: 'app-treasuries-supply',
  templateUrl: './treasuries-supply.component.html',
  styleUrls: ['./treasuries-supply.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TreasuriesSupplyComponent implements OnInit, OnDestroy {
  @Input() walletStats: Record<string, WalletStats>;
  @Input() walletSummaries$: Observable<Record<string, AddressTxSummary[]>>;
  @Input() treasuries: Treasury[] = [];
  @Input() showTitle = true;

  loadingTreasurySupply = true;
  isMobile: boolean;

  walletBalance: Record<string, Nitoshi> = {};

  @ViewChild('supplySvg') supplySvgElement: ElementRef<SVGElement>;
  @ViewChild('tooltip') tooltipElement: ElementRef<HTMLCanvasElement>;

  isLoadingWebSocket$: Observable<boolean>;
  subscription: Subscription;

  currentHeight: number;
  shares: SupplyShare[];

  totalTreasuries: Nitoshi;
  percentSupply: number;
  otherConfirmed: Nitoshi;
  pools: any;
  unavailableReason: string;

  tooltipPosition = { x: 0, y: 0 };
  hoverSection: SupplyShare | void;

  constructor(
    public stateService: StateService,
    private cd: ChangeDetectorRef,
    @Inject(LOCALE_ID) private locale: string,
  ) { }

  ngOnInit(): void {
    this.isLoadingWebSocket$ = this.stateService.isLoadingWebSocket$;
    this.init();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.walletSummaries$ || changes.treasuries || changes.walletStats) {
      this.init();
    }
  }

  init(): void {
    if (this.walletSummaries$ && this.treasuries && this.walletStats) {
      this.subscription?.unsubscribe();
      this.subscription = combineLatest([this.stateService.chainTip$.pipe(startWith(this.stateService.latestBlockHeight)), this.walletSummaries$, this.stateService.nitoPools$]).pipe(
        map(([chainTip, summaries, pools]) => {
          this.pools = pools;
          this.currentHeight = chainTip;
          this.walletBalance = {};
          for (const treasury of this.treasuries) {
            const total = this.walletStats[treasury.wallet] ? this.walletStats[treasury.wallet].balance : money.sum(...(summaries[treasury.wallet] || []).map(tx => tx.value)) || 0;
            this.walletBalance[treasury.wallet] = total;
          }
          this.processSupplyShares();
        })
      ).subscribe();
    }
  }

  processSupplyShares(): void {
    this.shares = [];
    this.hoverSection = undefined;
    this.loadingTreasurySupply = false;
    const total: Nitoshi = this.pools?.total?.chainValueNitoshi;
    const treasuryTotal = money.sum(...Object.values(this.walletBalance));
    if (total == null || money.compare(total, 0) <= 0 || money.compare(treasuryTotal, total) > 0) {
      this.unavailableReason = 'Confirmed Nito accounting is unavailable or synchronizing. No emission projection is inferred.';
      this.cd.markForCheck();
      return;
    }
    this.unavailableReason = null;
    this.totalTreasuries = treasuryTotal;
    this.otherConfirmed = money.subtract(total, treasuryTotal);
    this.percentSupply = money.approximate(treasuryTotal) / money.approximate(total) * 100;
    let offset = 0;
    for (const [label, type, amount] of [['Treasuries', 'treasuries', treasuryTotal], ['Other confirmed', 'mined', this.otherConfirmed]]) {
      const share = money.approximate(amount) / money.approximate(total);
      this.shares.push({ label, type, btc: amount, share, x: `${offset * 100}%`, w: `${share * 100}%` });
      offset += share;
    }
    this.cd.markForCheck();
  }

  @HostListener('pointerdown', ['$event'])
  onPointerDown(event): void {
    if (this.supplySvgElement?.nativeElement?.contains(event.target)) {
      this.onPointerMove(event);
      event.preventDefault();
    }
  }

  @HostListener('pointermove', ['$event'])
  onPointerMove(event): void {
    if (this.supplySvgElement?.nativeElement?.contains(event.target)) {
      let x = event.clientX;
      const y = event.clientY - 100;
      if (this.tooltipElement) {
        const elementBounds = this.tooltipElement.nativeElement.getBoundingClientRect();
        x -= elementBounds.width / 2;
        x = Math.min(Math.max(x, 20), (window.innerWidth - 20 - elementBounds.width));
      }
      this.tooltipPosition = { x, y };
      this.cd.markForCheck();
    }
  }

  onHover(_, share: SupplyShare): void {
    this.hoverSection = share;
  }

  onBlur(): void {
    this.hoverSection = undefined;
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    this.isMobile = window.innerWidth <= 767.98;
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }
}
