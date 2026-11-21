import { Component, OnInit, ChangeDetectionStrategy, Input } from '@angular/core';
import { StateService } from '@app/services/state.service';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { getNitoVBytesPerSecondLimit } from '@app/shared/nito-throughput';
import { MempoolInfo } from '@interfaces/websocket.interface';

interface MempoolBlocksData {
  blocks: number;
  size: number;
}

interface MempoolInfoData {
  memPoolInfo: MempoolInfo;
  vBytesPerSecond: number;
  progressWidth: string;
  progressColor: string;
}

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterComponent implements OnInit {
  @Input() inline = false;

  mempoolBlocksData$: Observable<MempoolBlocksData>;
  mempoolInfoData$: Observable<MempoolInfoData>;
  vBytesPerSecondLimit = 1;
  isLoadingWebSocket$: Observable<boolean>;
  mempoolLoadingStatus$: Observable<number>;

  constructor(
    private stateService: StateService,
  ) {
    this.vBytesPerSecondLimit = getNitoVBytesPerSecondLimit(this.stateService.env.BLOCK_WEIGHT_UNITS);
  }

  ngOnInit() {
    this.isLoadingWebSocket$ = this.stateService.isLoadingWebSocket$;
    this.mempoolLoadingStatus$ = this.stateService.loadingIndicators$
      .pipe(
        map((indicators) => indicators.mempool !== undefined ? indicators.mempool : 100)
      );

      this.mempoolInfoData$ = combineLatest([
        this.stateService.mempoolInfo$,
        this.stateService.vbytesPerSecond$
      ])
      .pipe(
        map(([mempoolInfo, vbytesPerSecond]) => {
          const percent = Math.round((Math.min(vbytesPerSecond, this.vBytesPerSecondLimit) / this.vBytesPerSecondLimit) * 100);

          let progressColor = '#7CB342';
          if (vbytesPerSecond > this.vBytesPerSecondLimit) {
            progressColor = '#FDD835';
          }
          if (vbytesPerSecond > this.vBytesPerSecondLimit * 1.2) {
            progressColor = '#FFB300';
          }
          if (vbytesPerSecond > this.vBytesPerSecondLimit * 1.5) {
            progressColor = '#FB8C00';
          }
          if (vbytesPerSecond > this.vBytesPerSecondLimit * 1.8) {
            progressColor = '#F4511E';
          }
          if (vbytesPerSecond > this.vBytesPerSecondLimit * 2.1) {
            progressColor = '#D81B60';
          }

          const mempoolSizePercentage = (mempoolInfo.usage / mempoolInfo.maxmempool * 100);
          let mempoolSizeProgress = 'bg-danger';
          if (mempoolSizePercentage <= 50) {
            mempoolSizeProgress = 'bg-success';
          } else if (mempoolSizePercentage <= 75) {
            mempoolSizeProgress = 'bg-warning';
          }

          return {
            memPoolInfo: mempoolInfo,
            vBytesPerSecond: vbytesPerSecond,
            progressWidth: percent + '%',
            progressColor: progressColor,
            mempoolSizeProgress: mempoolSizeProgress,
          };
        })
      );

    this.mempoolBlocksData$ = this.stateService.mempoolBlocks$
      .pipe(
        map((mempoolBlocks) => {
          const size = mempoolBlocks.map((m) => m.blockSize).reduce((a, b) => a + b, 0);
          const vsize = mempoolBlocks.map((m) => m.blockVSize).reduce((a, b) => a + b, 0);

          return {
            size: size,
            blocks: Math.ceil(vsize / this.stateService.blockVSize)
          };
        })
      );
  }
}
