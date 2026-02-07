import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RcaView } from './rca-view';

describe('RcaView', () => {
  let component: RcaView;
  let fixture: ComponentFixture<RcaView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RcaView]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RcaView);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
