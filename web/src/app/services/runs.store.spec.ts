import { TestBed } from '@angular/core/testing';

import { RunsStore } from './runs.store';

describe('RunsStore', () => {
  let service: RunsStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RunsStore);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
