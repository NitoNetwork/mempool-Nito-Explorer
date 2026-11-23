import { Component, OnInit, ChangeDetectionStrategy, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { StateService } from '@app/services/state.service';
import { Observable, Subscription } from 'rxjs';
import { Recommendedfees } from '@interfaces/websocket.interface';
import { feeLevels } from '@app/app.constants';
import { tap } from 'rxjs/operators';
import { ThemeService } from '@app/services/theme.service';

@Component({
  selector: 'app-fees-box',
  templateUrl: './fees-box.component.html',
  styleUrls: ['./fees-box.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class FeesBoxComponent implements OnInit, OnDestroy {
  recommendedFees$: Observable<Recommendedfees | null>;
  themeStateSubscription: Subscription;
  gradient = 'linear-gradient(to right, var(--skeleton-bg), var(--skeleton-bg))';
  noPriority = 'var(--skeleton-bg)';
  fees: Recommendedfees;

  constructor(
    public stateService: StateService,
    private themeService: ThemeService,
    private cd: ChangeDetectorRef,
  ) { }

  ngOnInit(): void {
    this.recommendedFees$ = this.stateService.recommendedFees$
      .pipe(
        tap((fees) => {
          this.fees = fees;
          this.setFeeGradient();
        }
      )
    );
    this.themeStateSubscription = this.themeService.themeState$.subscribe((state) => {
      if (!state.loading) {
        this.setFeeGradient();
      }
    });
  }

  setFeeGradient() {
    if (!this.fees || !this.themeService.mempoolFeeColors) {
      return;
    }
    let feeLevelIndex = feeLevels.slice().reverse().findIndex((feeLvl) => this.fees.minimumFee >= feeLvl);
    feeLevelIndex = feeLevelIndex >= 0 ? feeLevels.length - feeLevelIndex : feeLevelIndex;
    const startColor = '#' + (this.themeService.mempoolFeeColors[feeLevelIndex - 1] || this.themeService.mempoolFeeColors[this.themeService.mempoolFeeColors.length - 1]);

    const fastestFee = this.fees.fastestFee ?? this.fees.minimumFee;
    feeLevelIndex = feeLevels.slice().reverse().findIndex((feeLvl) => fastestFee >= feeLvl);
    feeLevelIndex = feeLevelIndex >= 0 ? feeLevels.length - feeLevelIndex : feeLevelIndex;
    const endColor = '#' + (this.themeService.mempoolFeeColors[feeLevelIndex - 1] || this.themeService.mempoolFeeColors[this.themeService.mempoolFeeColors.length - 1]);

    this.gradient = `linear-gradient(to right, ${startColor}, ${endColor})`;
    this.noPriority = startColor;

    this.cd.markForCheck();
  }

  ngOnDestroy(): void {
    this.themeStateSubscription.unsubscribe();
  }
}
