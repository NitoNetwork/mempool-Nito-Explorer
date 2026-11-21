import { Component, OnInit, OnDestroy, HostBinding } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Env, StateService } from '@app/services/state.service';
import { WebsocketService } from '@app/services/websocket.service';
import { SeoService } from '@app/services/seo.service';
import { OpenGraphService } from '@app/services/opengraph.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-docs',
  templateUrl: './docs.component.html',
  styleUrls: ['./docs.component.scss'],
  standalone: false,
})
export class DocsComponent implements OnInit, OnDestroy {

  activeTab = 0;
  env: Env;
  showWebSocketTab = true;
  showElectrsTab = true;
  private paramSubscription: Subscription;

  @HostBinding('attr.dir') dir = 'ltr';

  constructor(
    private route: ActivatedRoute,
    private stateService: StateService,
    private websocket: WebsocketService,
    private seoService: SeoService,
    private ogService: OpenGraphService,
  ) {
    // Set activeTab in constructor so it's available before template renders
    const url = this.route.snapshot.url;
    if (url && url[1]) {
      if (url[1].path === 'rest') {
        this.activeTab = 0;
      } else if (url[1].path === 'websocket') {
        this.activeTab = 1;
      } else {
        this.activeTab = 2;
      }
    }
  }

  ngOnInit(): void {
    this.websocket.want(['blocks']);
    this.env = this.stateService.env;
    this.showElectrsTab = true;

    this.updateSeo(this.route.snapshot.url[1]?.path);

    // Subscribe to route param changes for subsequent tab switches
    this.paramSubscription = this.route.params.subscribe((params) => {
      const type = params['type'];
      if (type === 'rest') {
        this.activeTab = 0;
      } else if (type === 'websocket') {
        this.activeTab = 1;
      } else {
        this.activeTab = 2;
      }
      this.updateSeo(type);
    });

    document.querySelector<HTMLElement>( 'html' ).style.scrollBehavior = 'smooth';
  }

  private updateSeo(type: string): void {
    if (type === 'rest') {
      this.seoService.setTitle($localize`:@@meta.title.docs.rest:REST API`);
      this.seoService.setDescription($localize`:@@meta.description.docs.rest-bitcoin:Documentation for the Nito Mempool's Explorer REST API service: get info on addresses, transactions, blocks, fees, mining, and more.`);
    } else if (type === 'websocket') {
      this.seoService.setTitle($localize`:@@meta.title.docs.websocket:WebSocket API`);
      this.seoService.setDescription($localize`:@@meta.description.docs.websocket-bitcoin:Documentation for the Nito Mempool's Explorer WebSocket API service: get real-time info on blocks, mempools, transactions, addresses, and more.`);
    } else {
      this.seoService.setTitle($localize`:@@meta.title.docs.electrum:Electrum RPC`);
      this.seoService.setDescription($localize`:@@meta.description.docs.electrumrpc:Documentation for our Electrum RPC interface: get instant, convenient, and reliable access to an Esplora instance.`);
    }
  }

  ngOnDestroy(): void {
    document.querySelector<HTMLElement>( 'html' ).style.scrollBehavior = 'auto';
    if (this.paramSubscription) {
      this.paramSubscription.unsubscribe();
    }
  }
}
