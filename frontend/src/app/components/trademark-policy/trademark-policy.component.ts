import { Component } from '@angular/core';
import { SeoService } from '@app/services/seo.service';
import { OpenGraphService } from '@app/services/opengraph.service';

@Component({
  selector: 'app-trademark-policy',
  templateUrl: './trademark-policy.component.html',
  styleUrls: ['./trademark-policy.component.scss'],
  standalone: false,
})
export class TrademarkPolicyComponent {
  constructor(
    private seoService: SeoService,
    private ogService: OpenGraphService,
  ) { }

  ngOnInit(): void {
    this.seoService.setTitle('Names and trademarks');
    this.seoService.setDescription('Trademark and attribution boundaries for Nito Mempool Explorer and its upstream open-source software.');
    this.ogService.setManualOgImage('trademark-policy.jpg');
  }
}
