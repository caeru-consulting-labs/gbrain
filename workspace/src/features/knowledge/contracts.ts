/** Presentation contract only. Tenant/workspace/project identifiers do not grant access or map to GBrain sources. */
export type KnowledgeContext = {
  organizationId: string;
  workspaceId: string;
  projectId: string | null;
  visibility: 'workspace' | 'restrito';
};

/** These states must come from a future authorized ingestion service; this UI only creates waiting items. */
export type IngestionStatus = 'waiting' | 'uploading' | 'extracting' | 'indexing' | 'available' | 'failed';
export const ingestionStatusLabel: Record<IngestionStatus, string> = {
  waiting: 'Aguardando envio', uploading: 'Enviando', extracting: 'Extraindo conteúdo',
  indexing: 'Indexando', available: 'Disponível', failed: 'Falha no processamento',
};
export type PendingDocument = { id: string; file: File; status: 'waiting' };
/** Future adapter must preserve server receipts, source scope and access enforcement. */
export interface KnowledgeIngestionService {
  submitDocuments(context: KnowledgeContext, files: File[]): Promise<{ requestId: string }>;
  getStatus(requestId: string): Promise<{ status: IngestionStatus }>;
}
