import type { JSONOutput } from "typedoc";

export type TDProject = JSONOutput.ProjectReflection;
export type TDDeclaration = JSONOutput.DeclarationReflection | JSONOutput.ReferenceReflection;
export type TDSignature = JSONOutput.SignatureReflection;
export type TDParameter = JSONOutput.ParameterReflection;
export type TDTypeParameter = JSONOutput.TypeParameterReflection;
export type TDSource = JSONOutput.SourceReference;
export type TDType = JSONOutput.SomeType;
export type TDComment = JSONOutput.Comment;
export type TDCommentPart = JSONOutput.CommentDisplayPart;

export function isDeclarationReflection(
  reflection: JSONOutput.SomeReflection,
): reflection is TDDeclaration {
  return reflection.variant === "declaration" || reflection.variant === "reference";
}

export function isReferenceReflection(
  reflection: TDDeclaration,
): reflection is JSONOutput.ReferenceReflection {
  return reflection.variant === "reference";
}

export function getDeclarationChildren(reflection: {
  children?: JSONOutput.SomeReflection[];
}): TDDeclaration[] {
  return (reflection.children ?? []).filter(isDeclarationReflection);
}
