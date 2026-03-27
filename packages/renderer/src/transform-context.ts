import type { Breadcrumb } from "./viewmodel.ts";

export interface TransformContext {
  idToUrl: Map<number, string>;
  idToBreadcrumbs: Map<number, Breadcrumb[]>;
  pkgName: string;
  pkgVersion: string;
}
