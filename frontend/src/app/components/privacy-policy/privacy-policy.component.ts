import { Component } from '@angular/core';
import { SeoService } from '@app/services/seo.service';
import { OpenGraphService } from '@app/services/opengraph.service';

@Component({
  selector: 'app-privacy-policy',
  templateUrl: './privacy-policy.component.html',
  styleUrls: ['./privacy-policy.component.scss'],
  standalone: false,
})
export class PrivacyPolicyComponent {
  constructor(
    private seoService: SeoService,
    private ogService: OpenGraphService,
  ) { }

  ngOnInit(): void {
    this.seoService.setTitle('Privacy Policy');
    this.seoService.setDescription('Privacy boundaries for public Nito chain data, browser preferences, wallet data, and self-hosted explorer deployments.');
    this.ogService.setManualOgImage('privacy.jpg');
  }
}
