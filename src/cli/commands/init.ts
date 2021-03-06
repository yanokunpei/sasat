import { writeYmlFile } from '../../util/fsUtil';
import { defaultConf } from '../../config/config';
import { Console } from '../console';
import * as fs from 'fs';

export const init = (): void => {
  if (fs.existsSync('./sasat.yml')) {
    Console.error('sasat.yml already exist');
    return;
  }
  writeYmlFile('./', 'sasat.yml', defaultConf);
  Console.success('sasat.yml created');
};
