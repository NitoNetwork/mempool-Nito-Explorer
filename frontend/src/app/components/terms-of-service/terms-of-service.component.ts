import { Component } from '@angular/core';
import { SeoService } from '@app/services/seo.service';
import { OpenGraphService } from '@app/services/opengraph.service';

@Component({
  selector: 'app-terms-of-service',
  templateUrl: './terms-of-service.component.html',
  standalone: false,
})
export class TermsOfServiceComponent {
  constructor(
    private seoService: SeoService,
    private ogService: OpenGraphService,
  ) { }

  ngOnInit(): void {
    this.seoService.setTitle('Software and data notice');
    this.seoService.setDescription('Important limits for Nito Mempool Explorer software, public network data, and self-hosted deployments.');
    this.ogService.setManualOgImage('tos.jpg');
  }
}
