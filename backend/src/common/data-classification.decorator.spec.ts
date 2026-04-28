import 'reflect-metadata';
import {
  DataClassification,
  getDataClassification,
  listClassifiedProperties,
} from './data-classification.decorator';

class Sample {
  @DataClassification('public')
  publicField: string;

  @DataClassification('internal')
  internalField: number;

  @DataClassification('confidential')
  email: string;

  @DataClassification('restricted')
  passwordHash: string;

  unannotatedField: string;
}

describe('DataClassification decorator', () => {
  it('records classification on a property', () => {
    const sample = new Sample();
    expect(getDataClassification(sample, 'publicField')).toBe('public');
    expect(getDataClassification(sample, 'internalField')).toBe('internal');
    expect(getDataClassification(sample, 'email')).toBe('confidential');
    expect(getDataClassification(sample, 'passwordHash')).toBe('restricted');
  });

  it('returns undefined for unannotated properties', () => {
    const sample = new Sample();
    expect(getDataClassification(sample, 'unannotatedField')).toBeUndefined();
  });

  it('lists every classified property on the prototype', () => {
    const props = listClassifiedProperties(Sample);
    expect(props).toEqual(
      expect.arrayContaining([
        { propertyKey: 'publicField', level: 'public' },
        { propertyKey: 'internalField', level: 'internal' },
        { propertyKey: 'email', level: 'confidential' },
        { propertyKey: 'passwordHash', level: 'restricted' },
      ]),
    );
    // Unannotated property is not listed.
    expect(
      props.find((p) => p.propertyKey === 'unannotatedField'),
    ).toBeUndefined();
  });

  it('lists classifications when given an instance', () => {
    const sample = new Sample();
    const props = listClassifiedProperties(sample);
    expect(props.length).toBe(4);
  });

  it('does not collide between distinct classes', () => {
    class Other {
      @DataClassification('restricted')
      iban: string;
    }
    const a = new Sample();
    const b = new Other();
    expect(getDataClassification(a, 'iban')).toBeUndefined();
    expect(getDataClassification(b, 'iban')).toBe('restricted');
  });
});
