export type IntakeFieldType = "date" | "time" | "text" | "textarea" | "select";

export interface IntakeField {
  key: string;
  label: string;
  type: IntakeFieldType;
  required: boolean;
  options?: string[];
}

export type IntakeSchema = IntakeField[];
