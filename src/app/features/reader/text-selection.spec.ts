import { getTextLayerSelectionAnchor } from './text-selection';

const MOCK_RECT: DOMRect = {
  left: 10,
  top: 20,
  width: 100,
  height: 30,
  right: 110,
  bottom: 50,
  x: 10,
  y: 20,
  toJSON: () => ({}),
};

describe('getTextLayerSelectionAnchor', () => {
  let root: HTMLElement;
  let firstLayer: HTMLElement;
  let secondLayer: HTMLElement;
  let getBoundingClientRectSpy: jest.SpyInstance;

  beforeEach(() => {
    root = document.createElement('div');
    firstLayer = document.createElement('div');
    firstLayer.className = 'textLayer';
    firstLayer.innerHTML = '<span>Hello</span>';
    secondLayer = document.createElement('div');
    secondLayer.className = 'textLayer';
    secondLayer.innerHTML = '<span>World</span>';
    root.append(firstLayer, secondLayer);
    document.body.append(root);

    getBoundingClientRectSpy = jest
      .spyOn(Range.prototype, 'getBoundingClientRect')
      .mockReturnValue(MOCK_RECT);

    window.getSelection()?.removeAllRanges();
  });

  afterEach(() => {
    getBoundingClientRectSpy.mockRestore();
    root.remove();
  });

  it('returns null when there is no selection', () => {
    expect(getTextLayerSelectionAnchor(null, root)).toBeNull();
  });

  it('returns null when the selection is collapsed', () => {
    const range = document.createRange();
    range.selectNodeContents(firstLayer.querySelector('span')!);
    range.collapse(true);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    expect(getTextLayerSelectionAnchor(selection, root)).toBeNull();
  });

  it('returns the mocked bounding rect when the range is inside a single text layer', () => {
    const range = document.createRange();
    range.selectNodeContents(firstLayer.querySelector('span')!);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    const anchor = getTextLayerSelectionAnchor(selection, root);

    expect(anchor).toEqual({ left: 10, top: 20, width: 100, height: 30 });
  });

  it('returns null when the selection spans two different text layers', () => {
    const range = document.createRange();
    range.setStart(firstLayer.querySelector('span')!.firstChild!, 0);
    range.setEnd(secondLayer.querySelector('span')!.firstChild!, 1);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    expect(getTextLayerSelectionAnchor(selection, root)).toBeNull();
  });

  it('returns null when the range is outside the given root', () => {
    const outside = document.createElement('div');
    outside.className = 'textLayer';
    outside.innerHTML = '<span>Outside</span>';
    document.body.append(outside);

    const range = document.createRange();
    range.selectNodeContents(outside.querySelector('span')!);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    expect(getTextLayerSelectionAnchor(selection, root)).toBeNull();

    outside.remove();
  });

  it('returns null when the bounding rect has zero width and height', () => {
    getBoundingClientRectSpy.mockReturnValue({ ...MOCK_RECT, width: 0, height: 0 });
    const range = document.createRange();
    range.selectNodeContents(firstLayer.querySelector('span')!);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    expect(getTextLayerSelectionAnchor(selection, root)).toBeNull();
  });
});
