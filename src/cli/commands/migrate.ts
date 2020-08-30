import { MigrationController } from '../../migration/controller';
import { getDbClient } from '../..';
import { Console } from '../console';
import { DataStoreHandler } from '../../entity/dataStore';
import { Parser } from '../../parser/parser';
import { CodeGenerateController } from '../../generator/controller';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const migrate = async (options: { [key: string]: boolean }) => {
  let current;
  try {
    const migration = new MigrationController();
    const result = await migration.migrate();
    current = result.currentMigration;
    if (options.generateFiles) {
      const storeHandler = new DataStoreHandler(result.store);
      const ir = new Parser().parse(storeHandler);
      await new CodeGenerateController(ir).generate();
    }
  } catch (e) {
    Console.error(e.message);
    throw e;
  } finally {
    await getDbClient().release();
  }
  Console.success(`current migration is ${current}`);
};
