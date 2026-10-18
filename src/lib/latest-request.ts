/** A session/import boundary invalidates responses from any earlier request. */
export class LatestRequest {
  private sequence = 0;
  begin() {
    return ++this.sequence;
  }
  invalidate() {
    this.sequence++;
  }
  isCurrent(ticket: number) {
    return ticket === this.sequence;
  }
}
