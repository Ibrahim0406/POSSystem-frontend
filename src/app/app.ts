import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import { AuthService } from './core/auth.service';
import { HlmDropdownMenu } from '@spartan-ng/helm/dropdown-menu/src/lib/hlm-dropdown-menu';
import { HlmDropdownMenuItem } from '@spartan-ng/helm/dropdown-menu/src/lib/hlm-dropdown-menu-item';
import { HlmDropdownMenuLabel } from '@spartan-ng/helm/dropdown-menu/src/lib/hlm-dropdown-menu-label';
import { HlmDropdownMenuSeparator } from '@spartan-ng/helm/dropdown-menu/src/lib/hlm-dropdown-menu-separator';
import { HlmDropdownMenuTrigger } from '@spartan-ng/helm/dropdown-menu/src/lib/hlm-dropdown-menu-trigger';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    HlmButton,
    HlmDropdownMenu,
    HlmDropdownMenuItem,
    HlmDropdownMenuLabel,
    HlmDropdownMenuSeparator,
    HlmDropdownMenuTrigger,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  auth = inject(AuthService);
  canViewBranchOrders = this.auth.canViewBranchOrders;
  isAdmin = this.auth.isAdmin;
  protected readonly title = signal('POSSystem-frontend');
}
