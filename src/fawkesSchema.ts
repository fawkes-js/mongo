import { Schema } from "mongoose";

export class FawkesSchema extends Schema {
  constructor(data) {
    super({ ...data, _id: String }, { autoCreate: false });
  }
}
