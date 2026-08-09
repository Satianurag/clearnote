const {
  ANote,
  CLLAT,
  CLINV,
  InvoiceRegistry,
  ClearNoteController,
  DvPEscrow,
  SanctionsRegistry,
  AuditAnchor,
} = require("../generated");

function eventId(event) {
  return `${event.chainId}_${event.block.number}_${event.logIndex}`;
}

function handleTransfer(contractName) {
  return async ({ event, context }) => {
    context.Transfer.set({
      id: eventId(event),
      from: event.params.from,
      to: event.params.to,
      value: event.params.value,
      token: contractName,
    });
  };
}

ANote.Transfer.handler(handleTransfer("CLNOTE02"));
CLLAT.Transfer.handler(handleTransfer("CLLAT01"));
CLINV.Transfer.handler(handleTransfer("CLINV01"));

InvoiceRegistry.InvoiceRegistered.handler(async ({ event, context }) => {
  context.InvoiceRegistered.set({
    id: eventId(event),
    invoiceId: event.params.invoiceId,
    originator: String(event.params.originator).toLowerCase(),
    obligor: String(event.params.obligor).toLowerCase(),
  });
});

InvoiceRegistry.DuplicateAttempted.handler(async ({ event, context }) => {
  context.DuplicateAttempted.set({
    id: eventId(event),
    invoiceId: event.params.invoiceId,
    wouldBeOriginator: event.params.wouldBeOriginator,
    existingOriginator: event.params.existingOriginator,
  });
});

InvoiceRegistry.ObligorAccepted.handler(async ({ event, context }) => {
  context.ObligorAccepted.set({
    id: eventId(event),
    invoiceId: event.params.invoiceId,
    obligor: event.params.obligor,
    deadline: event.params.deadline,
  });
});

InvoiceRegistry.InvoiceFinanced.handler(async ({ event, context }) => {
  context.InvoiceFinanced.set({
    id: eventId(event),
    invoiceId: event.params.invoiceId,
    noteToken: event.params.noteToken,
    units: event.params.units,
  });
});

InvoiceRegistry.InvoiceSettled.handler(async ({ event, context }) => {
  context.InvoiceSettled.set({
    id: eventId(event),
    invoiceId: event.params.invoiceId,
  });
});

InvoiceRegistry.InvoiceDefaulted.handler(async ({ event, context }) => {
  context.InvoiceDefaulted.set({
    id: eventId(event),
    invoiceId: event.params.invoiceId,
  });
});

InvoiceRegistry.DisputeRaised.handler(async ({ event, context }) => {
  context.DisputeRaised.set({
    id: eventId(event),
    invoiceId: event.params.invoiceId,
    evidenceHash: event.params.evidenceHash,
  });
});

ClearNoteController.NoteIssued.handler(async ({ event, context }) => {
  context.NoteIssued.set({
    id: eventId(event),
    invoiceId: event.params.invoiceId,
    noteToken: event.params.noteToken,
    to: event.params.to,
    units: event.params.units,
  });
});

DvPEscrow.OfferPosted.handler(async ({ event, context }) => {
  context.OfferPosted.set({
    id: eventId(event),
    offerId: event.params.offerId,
    maker: String(event.params.maker).toLowerCase(),
    noteToken: event.params.noteToken,
    cashToken: event.params.cashToken,
    units: event.params.units,
    pricePerUnit: event.params.pricePerUnit,
    minFill: event.params.minFill,
    expiry: event.params.expiry,
  });
});

DvPEscrow.OfferFilled.handler(async ({ event, context }) => {
  context.OfferFilled.set({
    id: eventId(event),
    offerId: event.params.offerId,
    buyer: event.params.buyer,
    units: event.params.units,
    cashPaid: event.params.cashPaid,
  });
});

DvPEscrow.OfferCancelled.handler(async ({ event, context }) => {
  context.OfferCancelled.set({
    id: eventId(event),
    offerId: event.params.offerId,
    maker: event.params.maker,
  });
});

SanctionsRegistry.RootCommitted.handler(async ({ event, context }) => {
  context.RootCommitted.set({
    id: eventId(event),
    root: event.params.root,
    sourceUri: event.params.sourceUri,
    publishedAt: event.params.publishedAt,
  });
});

SanctionsRegistry.SanctionedAdded.handler(async ({ event, context }) => {
  context.SanctionedAdded.set({
    id: eventId(event),
    who: event.params.who,
  });
});

AuditAnchor.Anchored.handler(async ({ event, context }) => {
  context.Anchored.set({
    id: eventId(event),
    anchorId: event.params.anchorId,
    packHash: event.params.packHash,
    uri: event.params.uri,
    periodStart: event.params.periodStart,
    periodEnd: event.params.periodEnd,
  });
});
