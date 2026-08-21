export type IntakeFieldType = "date" | "time" | "text" | "textarea" | "select" | "photo";

export interface IntakeField {
  key: string;
  label: string;
  type: IntakeFieldType;
  required: boolean;
  options?: string[];
}

export type IntakeSchema = IntakeField[];
