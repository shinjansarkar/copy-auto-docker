import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: true,
  template: `
    <div>
      <h1>Angular Application</h1>
      <p>Testing Auto-Docker Extension</p>
    </div>
  `
})
export class AppComponent {
  title = 'angular-app';
}
