export type OcrTextBlock = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OcrRecognition = {
  blocks: OcrTextBlock[];
  width: number;
  height: number;
};

export type SharedImageBarcode = {
  data: string;
  type: string;
  bounds?: { origin?: { x?: number; y?: number }; size?: { width?: number; height?: number } };
};

export type SharedImageRecognition = OcrRecognition & {
  barcodes: SharedImageBarcode[];
};
