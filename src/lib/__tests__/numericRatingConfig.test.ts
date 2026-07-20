import { describe, it, expect } from 'vitest';
import {
  validateNumericRatingConfig,
  validateNumericRatingValue,
  getNumericRatingSteps,
  DEFAULT_NUMERIC_RATING,
  type NumericRatingConfig,
} from '../../components/respondent/questionTypes';

describe('validateNumericRatingConfig', () => {
  it('passes for valid config', () => {
    const config: NumericRatingConfig = { min_value: 1, max_value: 10, step_value: 1, min_label: null, max_label: null };
    expect(validateNumericRatingConfig(config)).toEqual([]);
  });

  it('passes for fractional step', () => {
    const config: NumericRatingConfig = { min_value: 0, max_value: 1, step_value: 0.25, min_label: null, max_label: null };
    expect(validateNumericRatingConfig(config)).toEqual([]);
  });

  it('fails when max <= min', () => {
    const config: NumericRatingConfig = { min_value: 5, max_value: 5, step_value: 1, min_label: null, max_label: null };
    const errors = validateNumericRatingConfig(config);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/greater than minimum/);
  });

  it('fails when max < min', () => {
    const config: NumericRatingConfig = { min_value: 10, max_value: 1, step_value: 1, min_label: null, max_label: null };
    expect(validateNumericRatingConfig(config).length).toBeGreaterThan(0);
  });

  it('fails when step <= 0', () => {
    const config: NumericRatingConfig = { min_value: 1, max_value: 10, step_value: 0, min_label: null, max_label: null };
    const errors = validateNumericRatingConfig(config);
    expect(errors.some((e) => /[Ss]tep.*greater than 0/.test(e))).toBe(true);
  });

  it('fails for negative step', () => {
    const config: NumericRatingConfig = { min_value: 1, max_value: 10, step_value: -1, min_label: null, max_label: null };
    expect(validateNumericRatingConfig(config).length).toBeGreaterThan(0);
  });
});

describe('validateNumericRatingValue', () => {
  const config: NumericRatingConfig = { min_value: 1, max_value: 10, step_value: 1, min_label: null, max_label: null };

  it('passes for value within range and aligned to step', () => {
    expect(validateNumericRatingValue(config, 5)).toBeNull();
    expect(validateNumericRatingValue(config, 1)).toBeNull();
    expect(validateNumericRatingValue(config, 10)).toBeNull();
  });

  it('fails for value below minimum', () => {
    expect(validateNumericRatingValue(config, 0)).not.toBeNull();
  });

  it('fails for value above maximum', () => {
    expect(validateNumericRatingValue(config, 11)).not.toBeNull();
  });

  it('fails for value not aligned to step', () => {
    const cfg: NumericRatingConfig = { min_value: 0, max_value: 10, step_value: 2, min_label: null, max_label: null };
    expect(validateNumericRatingValue(cfg, 1)).not.toBeNull();
    expect(validateNumericRatingValue(cfg, 2)).toBeNull();
    expect(validateNumericRatingValue(cfg, 4)).toBeNull();
  });

  it('passes for fractional steps', () => {
    const cfg: NumericRatingConfig = { min_value: 0, max_value: 1, step_value: 0.25, min_label: null, max_label: null };
    expect(validateNumericRatingValue(cfg, 0)).toBeNull();
    expect(validateNumericRatingValue(cfg, 0.25)).toBeNull();
    expect(validateNumericRatingValue(cfg, 0.5)).toBeNull();
    expect(validateNumericRatingValue(cfg, 0.75)).toBeNull();
    expect(validateNumericRatingValue(cfg, 1)).toBeNull();
    expect(validateNumericRatingValue(cfg, 0.3)).not.toBeNull();
  });
});

describe('getNumericRatingSteps', () => {
  it('generates 1-10 by 1 with default config', () => {
    const steps = getNumericRatingSteps(DEFAULT_NUMERIC_RATING);
    expect(steps).toHaveLength(10);
    expect(steps[0]).toBe(1);
    expect(steps[9]).toBe(10);
  });

  it('generates 0-10 by 2', () => {
    const cfg: NumericRatingConfig = { min_value: 0, max_value: 10, step_value: 2, min_label: null, max_label: null };
    const steps = getNumericRatingSteps(cfg);
    expect(steps).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it('generates 1-5 by 1', () => {
    const cfg: NumericRatingConfig = { min_value: 1, max_value: 5, step_value: 1, min_label: null, max_label: null };
    const steps = getNumericRatingSteps(cfg);
    expect(steps).toEqual([1, 2, 3, 4, 5]);
  });

  it('generates fractional steps', () => {
    const cfg: NumericRatingConfig = { min_value: 0, max_value: 1, step_value: 0.25, min_label: null, max_label: null };
    const steps = getNumericRatingSteps(cfg);
    expect(steps).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });
});
