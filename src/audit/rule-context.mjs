export class RuleContext { constructor(addFinding) { this.addFinding = addFinding; } add(finding) { this.addFinding(finding); } }
