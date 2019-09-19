import * as path from "path";
import * as fs from "fs";
import { SasatRedisCacheType } from "../sasat/redisCacheConf";
import { SasatConfig, SasatConfigDb, SasatConfigMigration, SasatConfigRedis } from "./config";
import { readYmlFile } from "../util";

// TODO refactoring and default value
export class SasatConfigLoader {
  private static loadFile() {
    const fileName = "sasat.yml";
    const filepath = path.join(process.cwd(), fileName);
    if (!fs.existsSync(filepath)) throw new Error(`${fileName} not Found in Project root folder`);
    return readYmlFile(filepath);
  }

  readonly db: SasatConfigDb;
  readonly redis: SasatConfigRedis;
  readonly initCaches: SasatRedisCacheType[];
  readonly migration: SasatConfigMigration;

  constructor() {
    const obj = SasatConfigLoader.loadFile();
    this.db = (this.readDBConf(obj.db) as unknown) as any;
    this.redis = (this.readRedisConf(obj.redis) as unknown) as any;
    this.initCaches = this.readCacheConf(obj.cache);
    this.migration = this.readMigrationConfig(obj.migration);
  }

  getConfig(): SasatConfig {
    return {
      db: this.db,
      redis: this.redis,
      initCaches: this.initCaches,
      migration: this.migration,
    };
  }

  private readDBConf(conf: { [key: string]: string }) {
    return {
      host: this.readValue(conf.host),
      port: this.readValue(conf.port),
      user: this.readValue(conf.user),
      password: this.readValue(conf.password),
      database: this.readValue(conf.database),
      connectionLimit: this.readValue(conf.connectionLimit),
    };
  }

  private readRedisConf(conf: { [key: string]: string }) {
    return {
      host: this.readValue(conf.host),
      port: this.readValue(conf.port),
      password: this.readValue(conf.password),
    };
  }

  private readCacheConf(conf: { [key: string]: any }): SasatRedisCacheType[] {
    return Object.entries(conf).map(([key, value]: any, index) => {
      return {
        name: key,
        type: value.type.toLowerCase(),
        keyPrefix: value.keyPrefix || `${index}__`,
        isKeyAutoIncrement: value.key_auto_increment,
        ...value,
      };
    });
  }

  private readValue(value: any) {
    if (!value) return value;
    if (typeof value === "string" && value.startsWith("$")) return process.env[value.slice(1)];
    return value;
  }

  private readMigrationConfig(conf: { [key: string]: string }): SasatConfigMigration {
    return conf as any;
  }
}