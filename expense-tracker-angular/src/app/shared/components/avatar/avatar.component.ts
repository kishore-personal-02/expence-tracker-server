import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-avatar',
  imports: [],
  templateUrl: './avatar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarComponent {
  readonly name = input('');
  readonly photo = input<string | null>(null);
  readonly size = input(40);
  readonly className = input('');

  readonly src = computed(() => {
    const photo = this.photo();
    if (photo) return photo;

    const initials =
      this.name()
        ?.split(' ')
        .filter(Boolean)
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() || '?';

    const seed = (this.name() || 'user').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const hue = seed % 360;
    const hue2 = (hue + 45) % 360;

    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'>` +
      `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
      `<stop offset='0%' stop-color='hsl(${hue},72%,52%)'/>` +
      `<stop offset='100%' stop-color='hsl(${hue2},72%,40%)'/>` +
      `</linearGradient></defs>` +
      `<rect width='100' height='100' rx='50' fill='url(#g)'/>` +
      `<text x='50' y='54' font-family='Arial, Helvetica, sans-serif' font-size='44' font-weight='700' fill='rgba(255,255,255,0.96)' text-anchor='middle' dominant-baseline='middle'>${initials}</text>` +
      `</svg>`;

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}