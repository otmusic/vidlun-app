/**
 * A note from the person to whoever makes the app. Only the text they typed
 * travels, plus which build it came from; nothing from the journal, ever.
 */
export interface IFeedbackSender {
  send(text: string): Promise<void>;
}
