import { TestBed } from '@angular/core/testing';
import { AvatarComponent } from './avatar.component';

describe('AvatarComponent', () => {
  async function setup(props?: Partial<{ name: string; size: number }>) {
    TestBed.configureTestingModule({});
    const fixture = TestBed.createComponent(AvatarComponent);
    if (props?.name !== undefined) fixture.componentRef.setInput('name', props.name);
    if (props?.size !== undefined) fixture.componentRef.setInput('size', props.size);
    fixture.detectChanges();
    return fixture;
  }

  it('renders an image with the user name as alt text', async () => {
    const fixture = await setup({ name: 'Kiran Sharma' });
    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.alt).toBe('Kiran Sharma');
    expect(img.src).toContain('data:image/svg+xml');
  });

  it('falls back gracefully and applies the requested size', async () => {
    const fixture = await setup({ size: 84 });
    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(img.alt).toBe('avatar');
    expect(img.style.width).toBe('84px');
    expect(img.style.height).toBe('84px');
  });
});