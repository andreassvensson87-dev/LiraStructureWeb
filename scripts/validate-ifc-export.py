"""Independent IFC4 schema/EXPRESS and geometry QA. Requires ifcopenshell and pytest."""
import argparse
import sys

import ifcopenshell
import ifcopenshell.geom
import ifcopenshell.validate

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("file")
args = parser.parse_args()
model = ifcopenshell.open(args.file)
logger = ifcopenshell.validate.json_logger()
ifcopenshell.validate.validate(model, logger, express_rules=True)
for statement in logger.statements:
    print(statement["level"], statement["message"], file=sys.stderr)
settings = ifcopenshell.geom.settings()
settings.set(settings.USE_WORLD_COORDS, True)
count = 0
failures = []
for product in model.by_type("IfcProduct"):
    if not product.Representation:
        continue
    try:
        shape = ifcopenshell.geom.create_shape(settings, product)
        if not shape.geometry.verts or not shape.geometry.faces:
            raise ValueError("No geometry")
        count += 1
    except Exception as error:
        failures.append((product.GlobalId, str(error)))
for identity, message in failures:
    print(identity, message, file=sys.stderr)
print(f"{model.schema}: {count} products with geometry, {len(logger.statements)} schema/EXPRESS issues, {len(failures)} geometry errors")
sys.exit(bool(logger.statements or failures))
