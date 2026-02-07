import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RunsList } from './runs-list';

describe('RunsList', () => {
  let component: RunsList;
  let fixture: ComponentFixture<RunsList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RunsList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RunsList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
