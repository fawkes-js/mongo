import { type Schema, connect } from "mongoose";

function isObject(item): any {
  return item && typeof item === "object" && !Array.isArray(item);
}

function mergeDeep(target, ...sources): any {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        mergeDeep(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return mergeDeep(target, ...sources);
}

interface ModelData {
  name: string;
  schema: Schema;
}

interface MongoStores {
  user: ModelData;
  guild: ModelData;
  guildMember: ModelData;
}

export class MongoConnector {
  url: string;
  connection: any;
  userStore: any;
  guildStore: any;
  guildMemberStore: any;
  private readonly guildMemberModelData: ModelData;
  private readonly userModelData: ModelData;
  private readonly guildModelData: ModelData;

  constructor(url: string, stores: MongoStores) {
    this.url = url;

    Object.defineProperty(this, "userStore", { value: null, writable: true });

    Object.defineProperty(this, "guildStore", { value: null, writable: true });

    Object.defineProperty(this, "guildMemberStore", { value: null, writable: true });

    this.guildMemberModelData = stores.guildMember;

    this.userModelData = stores.user;

    this.guildModelData = stores.guild;

    Object.defineProperty(this, "connection", { value: null, writable: true });
  }

  async initialize(): Promise<void> {
    this.connection = await connect(this.url);
    console.log("connected");
    this.userStore = this.connection.model(this.userModelData.name, this.userModelData.schema);
    this.guildStore = this.connection.model(this.guildModelData.name, this.guildModelData.schema);
    this.guildMemberStore = this.connection.model(this.guildMemberModelData.name, this.guildMemberModelData.schema);
  }

  async getUser(id: string): Promise<any> {
    let user = await this.userStore.findById(id);

    if (!user)
      try {
        user = await this.createUser(id);
      } catch (err) {
        user = await this.userStore.findById(id);
        if (!user) return;
      }
    return user;
  }

  async getGuild(id: string): Promise<any> {
    let guild = await this.guildStore.findById(id);

    if (!guild)
      try {
        guild = await this.createGuild(id);
      } catch (err) {
        guild = await this.guildStore.findById(id);
        if (!guild) return;
      }
    return guild;
  }

  async getGuildMember(id: string, guildId: string): Promise<any> {
    let guild = await this.getGuild(guildId);

    let guildMember = await guild.members.id(id);

    if (!guildMember)
      try {
        guildMember = await this.createGuildMember(id, guild);
      } catch (err) {
        guild = await this.getGuild(guildId);
        guildMember = await this.createGuildMember(id, guild);
      }

    return guildMember;
  }

  async createUser(id: string): Promise<any> {
    return this.userStore.create({ _id: id });
  }

  async createGuild(id: string): Promise<any> {
    return this.guildStore.create({ _id: id });
  }

  async createGuildMember(id: string, guild): Promise<any> {
    const member = guild.members.push({ _id: id });

    await guild.save();
    return member;
  }

  async updateGuild(id: string): Promise<any> {
    const GuildStore = this.guildStore;

    let guild = await this.guildStore.findOne({ _id: id });

    if (!guild)
      try {
        guild = await this.createGuild(id);
      } catch (err) {
        guild = await this.guildStore.findOne({ _id: id });
        if (!guild) return;
      }

    const merged = mergeDeep(new GuildStore().toObject(), guild.toObject());

    const updated = await this.guildStore.findOneAndUpdate({ _id: id }, merged);
    return updated;
  }

  async updateUser(id: string): Promise<any> {
    const UserStore = this.userStore;

    let user = await this.userStore.findOne({ _id: id });

    if (!user)
      try {
        user = await this.createUser(id);
      } catch (err) {
        user = await this.userStore.findOne({ _id: id });
        if (!user) return;
      }

    const merged = mergeDeep(new UserStore().toObject(), user.toObject());

    const updated = await this.userStore.findOneAndUpdate({ _id: id }, merged);
    return updated;
  }

  async updateGuildMember(id: string, guildId: string): Promise<any> {
    const GuildMemberStore = this.guildMemberStore;

    let guild = await this.guildStore.findOne({ _id: guildId });

    if (!guild)
      try {
        guild = await this.createGuild(guildId);
      } catch (err) {
        guild = await this.guildStore.findOne({ _id: guildId });
        if (!guild) return;
      }

    let member = await guild.members.id(id);

    if (!member)
      try {
        member = await this.createGuildMember(id, guild);
      } catch (err) {
        guild = await this.guildStore.findOne({ _id: guildId });
        member = await guild.members.id(id);
        if (!member) return;
      }
    else member = member.toObject();

    const merged = mergeDeep(new GuildMemberStore().toObject(), member);

    const index: number = guild.members.findIndex((member) => member._id === id);

    guild.members.splice(index, index + 1, new GuildMemberStore(merged));
    await this.guildStore.findOneAndUpdate({ _id: id }, guild);
    return merged;
  }
}
