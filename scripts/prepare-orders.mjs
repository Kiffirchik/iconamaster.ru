import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function prepareOrders(distRoot) {
  const target = path.join(distRoot, 'corona/admin/orders');
  await mkdir(target, { recursive: true });
  for (const name of ['store.php', 'admin.php']) await copyFile(path.join(root, 'server/orders', name), path.join(target, name));
  await copyFile(path.join(root, 'server/orders/endpoint.php'), path.join(distRoot, 'order-request.php'));
  await writeFile(path.join(distRoot, 'corona/admin/orders.php'), "<?php\nrequire dirname(__FILE__).'/orders/admin.php';\n");
}
