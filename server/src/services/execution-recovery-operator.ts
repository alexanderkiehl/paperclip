import type { AgentApiKeyScope } from "@paperclipai/shared";
import { EXECUTION_RECOVERY_OPERATOR_CAPABILITY } from "@paperclipai/shared";
import type { Request } from "express";
import { forbidden, unprocessable } from "../errors.js";
import { normalizeAgentPermissions } from "./agent-permissions.js";

export function actorHasExecutionRecoveryOperatorCapability(actor: {
  keyScope?: AgentApiKeyScope | null;
}): boolean {
  const scope = actor.keyScope;
  return (
    scope?.kind === "standard" &&
    Array.isArray(scope.capabilities) &&
    scope.capabilities.includes(EXECUTION_RECOVERY_OPERATOR_CAPABILITY)
  );
}

export function agentGrantExecutionRecoveryOperator(permissions: unknown): boolean {
  return normalizeAgentPermissions(permissions).execution_recovery_operator === true;
}

export function localAgentJwtScopeForExecutionRecovery(input: {
  workMode?: string | null;
  issueId?: string | null;
  permissions: unknown;
}): AgentApiKeyScope {
  if (input.workMode === "skill_test" && input.issueId) {
    return { kind: "skill_test", issueId: input.issueId };
  }
  if (agentGrantExecutionRecoveryOperator(input.permissions)) {
    return {
      kind: "standard",
      capabilities: [EXECUTION_RECOVERY_OPERATOR_CAPABILITY],
    };
  }
  return { kind: "standard" };
}

/** Board actors keep the existing path. Assigned agents need the narrow token capability. */
export function assertExecutionReconciliationAuthorized(
  req: Request,
  issue: { assigneeAgentId: string | null },
) {
  if (req.actor.type === "board") return;
  if (
    req.actor.type === "agent" &&
    req.actor.agentId &&
    issue.assigneeAgentId === req.actor.agentId &&
    actorHasExecutionRecoveryOperatorCapability(req.actor)
  ) {
    return;
  }
  throw forbidden("Execution recovery operator capability required", {
    code: "execution_recovery_operator_required",
  });
}

export function requireExecutionReconciliationProof(decision: unknown) {
  if (!decision || typeof decision !== "object") {
    throw unprocessable(
      "Reconcile the recorded execution and its action outcomes before continuing this task.",
      { code: "execution_reconciliation_required" },
    );
  }
}
