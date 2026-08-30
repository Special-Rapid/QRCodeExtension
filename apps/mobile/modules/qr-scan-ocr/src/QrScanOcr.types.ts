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
