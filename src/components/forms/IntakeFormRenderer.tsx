import type { IntakeSchema } from "@/lib/services/intake-schema";
import { Input, Select, Textarea } from "@/components/ui";

export type IntakeValues = Record<string, string>;

export function IntakeFormRenderer({
  schema,
  values,
  onChange,
}: {
  schema: IntakeSchema;
  values: IntakeValues;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {schema.map((field) => {
        const value = values[field.key] ?? "";
        const handleChange = (
          event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
        ) => onChange(field.key, event.target.value);

        switch (field.type) {
          case "select":
            return (
              <Select
                key={field.key}
                label={field.label}
                required={field.required}
                value={value}
                onChange={handleChange}
                placeholder={`Select ${field.label.toLowerCase()}`}
                options={(field.options ?? []).map((option) => ({
                  label: option,
                  value: option,
                }))}
              />
            );
          case "textarea":
            return (
              <Textarea
                key={field.key}
                label={field.label}
                required={field.required}
                value={value}
                onChange={handleChange}
              />
            );
          case "date":
            return (
              <Input
                key={field.key}
                type="date"
                label={field.label}
                required={field.required}
                value={value}
                onChange={handleChange}
              />
            );
          case "time":
            return (
              <Input
                key={field.key}
                type="time"
                label={field.label}
                required={field.required}
                value={value}
                onChange={handleChange}
              />
            );
          default:
            return (
              <Input
                key={field.key}
                type="text"
                label={field.label}
                required={field.required}
                value={value}
                onChange={handleChange}
              />
            );
        }
      })}
    </div>
  );
}
