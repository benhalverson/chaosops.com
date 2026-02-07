import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateRunForm } from './create-run-form';

describe('CreateRunForm', () => {
  let component: CreateRunForm;
  let fixture: ComponentFixture<CreateRunForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateRunForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateRunForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
