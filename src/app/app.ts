import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HlmButton],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('POSSystem-frontend');
}
