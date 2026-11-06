import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmH1 } from '@spartan-ng/helm/typography';
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HlmButton, HlmH1],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('POSSystem-frontend');
}
