/**
 * Base for every error the domain raises. Adapters catch this to tell a rule
 * violation apart from a network or storage failure.
 */
export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
