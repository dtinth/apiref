/**
 * Deeply nested namespace examples.
 *
 * @module namespaces
 */

/**
 * Top-level namespace for UI components.
 */
export namespace UI {
  /**
   * Button component namespace.
   */
  export namespace Button {
    /**
     * Variants for button styling.
     */
    export enum Variant {
      Primary = "primary",
      Secondary = "secondary",
      Danger = "danger",
    }

    /**
     * Button size options.
     */
    export enum Size {
      Small = "sm",
      Medium = "md",
      Large = "lg",
    }

    /**
     * Button component properties.
     */
    export interface Props {
      label: string;
      variant?: Variant;
      size?: Size;
      onClick?: () => void;
      disabled?: boolean;
    }

    /**
     * Render a button component.
     */
    export function create(props: Props): HTMLButtonElement {
      const btn = document.createElement("button");
      btn.textContent = props.label;
      btn.disabled = props.disabled ?? false;
      if (props.onClick) btn.addEventListener("click", props.onClick);
      return btn;
    }
  }

  /**
   * Form component namespace.
   */
  export namespace Form {
    /**
     * Input field types.
     */
    export enum InputType {
      Text = "text",
      Email = "email",
      Password = "password",
      Number = "number",
      Date = "date",
    }

    /**
     * Form field configuration.
     */
    export interface FieldConfig {
      name: string;
      label: string;
      type?: InputType;
      required?: boolean;
      placeholder?: string;
      validation?: (value: string) => boolean;
    }

    /**
     * Create a form input field.
     */
    export function createField(config: FieldConfig): HTMLInputElement {
      const input = document.createElement("input");
      input.type = config.type ?? InputType.Text;
      input.name = config.name;
      input.placeholder = config.placeholder ?? config.label;
      input.required = config.required ?? false;
      return input;
    }

    /**
     * Form validation namespace.
     */
    export namespace Validation {
      /**
       * Validation rule with custom error message.
       */
      export interface Rule {
        check: (value: string) => boolean;
        message: string;
      }

      /**
       * Email validation rule.
       */
      export const email: Rule = {
        check: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: "Invalid email address",
      };

      /**
       * Required field rule.
       */
      export const required: Rule = {
        check: (v) => v.trim().length > 0,
        message: "This field is required",
      };

      /**
       * Minimum length rule.
       */
      export function minLength(length: number): Rule {
        return {
          check: (v) => v.length >= length,
          message: `Must be at least ${length} characters`,
        };
      }

      /**
       * Validate a value against a set of rules.
       */
      export function validate(value: string, rules: Rule[]): string | null {
        for (const rule of rules) {
          if (!rule.check(value)) {
            return rule.message;
          }
        }
        return null;
      }

      /**
       * Deeply nested schema validation.
       */
      export namespace Schema {
        /**
         * Field schema with type and constraints.
         */
        export interface Field {
          type: "string" | "number" | "boolean";
          required?: boolean;
          minLength?: number;
          maxLength?: number;
        }

        /**
         * Schema object definition.
         */
        export interface ObjectSchema {
          [key: string]: Field;
        }

        /**
         * Validate an object against a schema.
         */
        export function validateObject(
          obj: Record<string, any>,
          schema: ObjectSchema
        ): Record<string, string[]> {
          const errors: Record<string, string[]> = {};

          for (const [key, fieldSchema] of Object.entries(schema)) {
            const value = obj[key];
            const fieldErrors: string[] = [];

            if (fieldSchema.required && (value === undefined || value === null || value === "")) {
              fieldErrors.push("This field is required");
            }

            if (typeof value === "string") {
              if (
                fieldSchema.minLength !== undefined &&
                value.length < fieldSchema.minLength
              ) {
                fieldErrors.push(
                  `Must be at least ${fieldSchema.minLength} characters`
                );
              }
              if (
                fieldSchema.maxLength !== undefined &&
                value.length > fieldSchema.maxLength
              ) {
                fieldErrors.push(
                  `Must be no more than ${fieldSchema.maxLength} characters`
                );
              }
            }

            if (fieldErrors.length > 0) {
              errors[key] = fieldErrors;
            }
          }

          return errors;
        }
      }
    }
  }
}

/**
 * API client namespace with deeply nested structure.
 */
export namespace API {
  /**
   * Base configuration for API calls.
   */
  export interface Config {
    baseUrl: string;
    timeout?: number;
    headers?: Record<string, string>;
  }

  /**
   * Request builder namespace.
   */
  export namespace Request {
    /**
     * HTTP methods.
     */
    export enum Method {
      Get = "GET",
      Post = "POST",
      Put = "PUT",
      Patch = "PATCH",
      Delete = "DELETE",
    }

    /**
     * Request options.
     */
    export interface Options {
      method?: Method;
      headers?: Record<string, string>;
      body?: any;
      timeout?: number;
    }

    /**
     * Build a request object.
     */
    export function build(url: string, options?: Options) {
      return {
        url,
        method: options?.method ?? Method.Get,
        headers: options?.headers ?? {},
        body: options?.body,
      };
    }

    /**
     * Interceptor namespace for middleware.
     */
    export namespace Interceptor {
      /**
       * Request interceptor type.
       */
      export type RequestInterceptor = (options: Options) => Options;

      /**
       * Response interceptor type.
       */
      export type ResponseInterceptor = (response: any) => any;

      /**
       * Error interceptor type.
       */
      export type ErrorInterceptor = (error: Error) => Error;

      /**
       * Interceptor chain manager.
       */
      export class Chain {
        private requestInterceptors: RequestInterceptor[] = [];
        private responseInterceptors: ResponseInterceptor[] = [];

        /**
         * Add a request interceptor.
         */
        addRequest(fn: RequestInterceptor): this {
          this.requestInterceptors.push(fn);
          return this;
        }

        /**
         * Add a response interceptor.
         */
        addResponse(fn: ResponseInterceptor): this {
          this.responseInterceptors.push(fn);
          return this;
        }

        /**
         * Execute request interceptors.
         */
        executeRequest(options: Options): Options {
          return this.requestInterceptors.reduce(
            (opts, fn) => fn(opts),
            options
          );
        }

        /**
         * Execute response interceptors.
         */
        executeResponse(response: any): any {
          return this.responseInterceptors.reduce(
            (resp, fn) => fn(resp),
            response
          );
        }
      }
    }
  }

  /**
   * Response handling namespace.
   */
  export namespace Response {
    /**
     * Typed response wrapper.
     */
    export interface Wrapper<T> {
      ok: boolean;
      status: number;
      data?: T;
      error?: string;
    }

    /**
     * Parse response data.
     */
    export function parse<T>(response: any): Wrapper<T> {
      return {
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        data: response.data,
        error: response.error,
      };
    }
  }
}
