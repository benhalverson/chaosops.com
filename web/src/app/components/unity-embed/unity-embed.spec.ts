import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UnityEmbed } from './unity-embed';

describe('UnityEmbed', () => {
  let component: UnityEmbed;
  let fixture: ComponentFixture<UnityEmbed>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnityEmbed]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UnityEmbed);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
