"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodSchema } from "zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { EntityType } from "@/lib/schemas/entities";
import { getCreateSchema } from "@/lib/schemas/entity-schema-map";

// Fields that render as Textarea
const TEXTAREA_FIELDS = new Set([
  "notes", "summary", "description", "evidence", "body", "quote",
  "vibeNotes", "topicsDiscussed", "actionTaken", "mitigationPlan",
  "resolutionNote", "summaryMarkdown", "strengthsMarkdown",
  "improvementsMarkdown", "autoSurfacedFlags", "sectionsTouched",
  "dimensions", "rubricRating",
]);

// Fields that render as date
const DATE_FIELDS = new Set([
  "startDate", "endDate", "date", "occurredOn", "raisedOn", "resolvedOn",
  "lastWorkingDay", "lastUpdated", "autoDecayOn", "biweekStart", "biweekEnd",
  "checkinDate", "outreachOpenOn", "signedOffOn", "sentOn",
  "responseReceivedOn", "reminderSentOn", "dueDate", "snoozedUntil",
  "completedOn", "nextMeetingOn", "effectiveFrom", "effectiveTo",
  "lastOutreachOn",
]);

// Fields that are booleans
const BOOL_FIELDS = new Set(["active", "resolved", "processed"]);

// Fields to skip entirely in the form (managed by system)
const SKIP_FIELDS = new Set([
  "id", "createdAt", "updatedAt", "archivedAt", "createdBy",
  "rawHash", "responseRate",
]);

interface EntityFormProps<T extends Record<string, unknown>> {
  entityType: EntityType;
  schema: ZodSchema<T>;
  initialValues?: Partial<T>;
  onSubmit: (data: T) => Promise<void>;
  onCancel?: () => void;
  mode?: "create" | "edit";
}

function unwrapOptional(zodType: z.ZodTypeAny): z.ZodTypeAny {
  const typeName = (zodType as { _def?: { typeName?: string }; constructor?: { name?: string } })?.constructor?.name;
  if (typeName === "ZodOptional" || typeName === "ZodNullable" || typeName === "ZodDefault") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inner = (zodType as any)._def?.innerType ?? (zodType as any)._def?.type;
    if (inner) return unwrapOptional(inner as z.ZodTypeAny);
  }
  return zodType;
}

function getTypeName(zodType: z.ZodTypeAny): string {
  return (zodType as { constructor?: { name?: string } })?.constructor?.name ?? "";
}

function getFieldType(key: string, zodType: z.ZodTypeAny): "textarea" | "date" | "boolean" | "number" | "select" | "text" {
  if (TEXTAREA_FIELDS.has(key)) return "textarea";
  if (DATE_FIELDS.has(key)) return "date";
  if (BOOL_FIELDS.has(key)) return "boolean";
  const unwrapped = unwrapOptional(zodType);
  const name = getTypeName(unwrapped);
  if (name === "ZodBoolean") return "boolean";
  if (name === "ZodNumber") return "number";
  if (name === "ZodEnum") return "select";
  if (name === "ZodDate") return "date";
  return "text";
}

function getEnumValues(zodType: z.ZodTypeAny): string[] {
  const unwrapped = unwrapOptional(zodType);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (unwrapped as any).options ?? [];
}

function toLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .replace(/Id$/, " ID")
    .trim();
}

export function EntityForm<T extends Record<string, unknown>>({
  schema,
  initialValues,
  onSubmit,
  onCancel,
  mode = "create",
}: EntityFormProps<T>) {
  const form = useForm<T>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    defaultValues: (initialValues ?? {}) as any,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shape = (schema as any).shape ?? {};

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data);
  });

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {Object.entries(shape).map(([key, zodType]) => {
          if (SKIP_FIELDS.has(key)) return null;
          const fieldType = getFieldType(key, zodType as z.ZodTypeAny);

          return (
            <FormField
              key={key}
              control={form.control}
              name={key as Parameters<typeof form.control.register>[0]}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{toLabel(key)}</FormLabel>
                  <FormControl>
                    {fieldType === "boolean" ? (
                      <Switch
                        checked={!!field.value}
                        onCheckedChange={field.onChange}
                      />
                    ) : fieldType === "select" ? (
                      <Select
                        value={typeof field.value === "string" ? field.value : ""}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={`Select ${toLabel(key)}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {getEnumValues(zodType as z.ZodTypeAny).map((v) => (
                            <SelectItem key={v} value={v}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : fieldType === "textarea" ? (
                      <Textarea
                        {...field}
                        value={typeof field.value === "string" ? field.value : ""}
                        rows={4}
                      />
                    ) : fieldType === "date" ? (
                      <Input
                        type="date"
                        value={
                          field.value instanceof Date
                            ? field.value.toISOString().slice(0, 10)
                            : typeof field.value === "string"
                            ? field.value.slice(0, 10)
                            : ""
                        }
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    ) : fieldType === "number" ? (
                      <Input
                        type="number"
                        {...field}
                        value={typeof field.value === "number" ? field.value : ""}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    ) : (
                      <Input
                        {...field}
                        value={typeof field.value === "string" ? field.value : ""}
                      />
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          );
        })}

        <div className="flex gap-2 pt-2">
          <Button type="submit">
            {mode === "create" ? "Create" : "Save changes"}
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}

// Convenience wrapper that loads the schema by entity type
export function EntityFormByType({
  entityType,
  initialValues,
  onSubmit,
  onCancel,
  mode,
}: {
  entityType: EntityType;
  initialValues?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  onCancel?: () => void;
  mode?: "create" | "edit";
}) {
  const schema = getCreateSchema(entityType) as ZodSchema<Record<string, unknown>> | null;
  if (!schema) return <p className="text-sm text-red-500">Unknown entity type: {entityType}</p>;
  return (
    <EntityForm
      entityType={entityType}
      schema={schema}
      initialValues={initialValues}
      onSubmit={onSubmit}
      onCancel={onCancel}
      mode={mode}
    />
  );
}

// Re-export Label for convenience
export { Label };
