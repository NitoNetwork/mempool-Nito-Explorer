import { Component, OnInit, Input, ChangeDetectionStrategy } from '@angular/core';
import { CpfpInfo } from '@interfaces/node-api.interface';
import { Transaction } from '@interfaces/electrs.interface';
import { money } from '@app/shared/nito-money';

@Component({
  selector: 'app-cpfp-info',
  templateUrl: './cpfp-info.component.html',
  styleUrls: ['./cpfp-info.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CpfpInfoComponent implements OnInit {
  readonly money = money;
  @Input() cpfpInfo: CpfpInfo;
  @Input() tx: Transaction;

  constructor() {}

  ngOnInit(): void {}

  roundToOneDecimal(cpfpTx: any): number {
    return cpfpTx.policy_vsize ? +money.feeRate(cpfpTx).toFixed(1) : NaN;
  }

  trackByIndex(index: number): number {
    return index;
  }
}
