export type SecurityRuleContext = {
    path: string;
    operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
    requestResourceData?: any;
};

// A custom error class to provide rich context for Firestore permission errors.
export class FirestorePermissionError extends Error {
    public readonly context: SecurityRuleContext;
    public readonly originalError?: any;

    constructor(context: SecurityRuleContext, originalError?: any) {
        const message = `Firestore Permission Denied: You do not have permission to perform the '${context.operation}' operation on the path '${context.path}'.`;
        super(message);
        this.name = 'FirestorePermissionError';
        this.context = context;
        this.originalError = originalError;

        // This is to make the error object serializable for the Next.js dev overlay
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
