import { Component, ChangeDetectionStrategy, OnChanges, Input } from '@angular/core';
import { calcSegwitFeeGains, isFeatureActive } from '@app/bitcoin.utils';
import { Transaction } from '@interfaces/electrs.interface';
import { StateService } from '@app/services/state.service';

@Component({
  selector: 'app-tx-features',
  templateUrl: './tx-features.component.html',
  styleUrls: ['./tx-features.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TxFeaturesComponent implements OnChanges {
  @Input() tx: Transaction;

  segwitGains = {
    realizedSegwitGains: 0,
    potentialSegwitGains: 0,
    potentialP2shSegwitGains: 0,
    potentialTaprootGains: 0,
    realizedTaprootGains: 0
  };
  isRbfTransaction: boolean;
  isTaproot: boolean;
  hasPrivateBundle = false;

  segwitEnabled: boolean;
  rbfEnabled: boolean;
  taprootEnabled: boolean;

  constructor(
    public stateService: StateService,
  ) { }

  ngOnChanges() {
    if (!this.tx) {
      this.hasPrivateBundle = false;
      return;
    }
    this.segwitEnabled = !this.tx.status.confirmed || isFeatureActive(this.stateService.network, this.tx.status.block_height, 'segwit');
    this.taprootEnabled = !this.tx.status.confirmed || isFeatureActive(this.stateService.network, this.tx.status.block_height, 'taproot');
    this.rbfEnabled = !this.tx.status.confirmed || isFeatureActive(this.stateService.network, this.tx.status.block_height, 'rbf');
    this.segwitGains = calcSegwitFeeGains(this.tx);
    this.isRbfTransaction = this.tx.vin.some((v) => v.sequence < 0xfffffffe);
    this.isTaproot = this.tx.vin.some((v) => v.prevout && v.prevout.scriptpubkey_type === 'v1_p2tr');
    this.hasPrivateBundle = !!this.tx.has_private_bundle || !!this.tx.private_bundle;
  }
}
