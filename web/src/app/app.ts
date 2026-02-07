import { Component } from '@angular/core';
import { Console } from './components/console/console';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [Console],
  template: `<app-console></app-console>`,
})
export class App {}
