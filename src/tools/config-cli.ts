/**
 * Configuration CLI tool for Image Resizer
 * Provides utilities for managing, validating, and converting configuration
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { program } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';

// Directory setup for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Create formatter for validation output
const formatters = {
  text: (errors) => {
    return errors
      .map((error) => {
        return `${chalk.red('Error:')} ${error.message}\n  at ${error.path.join('.')}`;
      })
      .join('\n\n');
  },
  json: (errors) => {
    return JSON.stringify(
      errors.map((error) => ({
        message: error.message,
        path: error.path.join('.'),
      })),
      null,
      2
    );
  },
  github: (errors) => {
    return errors
      .map((error) => {
        return `::error file=wrangler.jsonc,line=1,col=1::${error.message} at ${error.path.join(
          '.'
        )}`;
      })
      .join('\n');
  },
};

/**
 * Load template files from templates directory
 * @returns Array of available templates
 */
function loadTemplates() {
  const templatesDir = path.join(__dirname, '..', '..', 'templates');
  const templates = [];

  if (fs.existsSync(templatesDir)) {
    fs.readdirSync(templatesDir).forEach((file) => {
      if (file.endsWith('.json') || file.endsWith('.jsonc')) {
        templates.push({
          name: file.replace(/\.(json|jsonc)$/, ''),
          file: path.join(templatesDir, file),
        });
      }
    });
  }

  return templates;
}

/**
 * Validate a configuration against common schema rules
 * @param config Configuration object to validate
 * @returns Array of validation errors
 */
function validateConfig(config) {
  const errors = [];

  // Basic structure validation
  if (!config) {
    errors.push({
      message: 'Configuration must be a valid object',
      path: [],
    });
    return errors;
  }

  // Check required top-level fields
  const requiredFields = ['name', 'main', 'compatibility_date'];
  requiredFields.forEach((field) => {
    if (!config[field]) {
      errors.push({
        message: `Missing required field: ${field}`,
        path: [field],
      });
    }
  });

  // Validate environments if present
  if (config.env) {
    for (const [envName, envConfig] of Object.entries(config.env)) {
      // Environment should be an object
      if (typeof envConfig !== 'object' || envConfig === null) {
        errors.push({
          message: `Environment must be an object`,
          path: ['env', envName],
        });
        continue;
      }
    }
  }

  // Validate routes if present
  if (config.routes) {
    if (!Array.isArray(config.routes)) {
      errors.push({
        message: 'Routes must be an array',
        path: ['routes'],
      });
    } else {
      config.routes.forEach((route, index) => {
        if (typeof route !== 'object' || route === null) {
          errors.push({
            message: 'Route must be an object',
            path: ['routes', index],
          });
          return;
        }

        if (!route.pattern && !route.pathPattern) {
          errors.push({
            message: 'Route must have a pattern property',
            path: ['routes', index],
          });
        }
      });
    }
  }

  return errors;
}

/**
 * Apply environment-specific overrides to base configuration
 * @param config Base configuration
 * @param env Environment name
 * @returns Configuration with environment overrides applied
 */
function applyEnvironmentOverrides(config, env) {
  if (!config.env || !config.env[env]) {
    return config;
  }

  const envConfig = config.env[env];
  const result = { ...config };

  // Apply environment overrides
  for (const [key, value] of Object.entries(envConfig)) {
    if (typeof value === 'object' && value !== null && typeof result[key] === 'object') {
      // Merge objects
      result[key] = { ...result[key], ...value };
    } else {
      // Override primitive values
      result[key] = value;
    }
  }

  // Remove env section from result
  delete result.env;

  return result;
}

/**
 * Command to list available configuration templates
 */
program
  .command('list-templates')
  .description('List available configuration templates')
  .action(() => {
    const templates = loadTemplates();
    if (templates.length === 0) {
      console.log(chalk.yellow('No templates found.'));
      return;
    }

    console.log(chalk.green('Available templates:'));
    templates.forEach((template) => {
      console.log(`- ${template.name}`);
    });
  });

/**
 * Command to create a new config from a template
 */
program
  .command('create')
  .description('Create a new configuration file from a template')
  .action(async () => {
    const templates = loadTemplates();
    if (templates.length === 0) {
      console.error(chalk.red('No templates found. Please add templates to the templates folder.'));
      process.exit(1);
    }

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'template',
        message: 'Select a template:',
        choices: templates.map((t) => t.name),
      },
      {
        type: 'input',
        name: 'output',
        message: 'Output file:',
        default: 'wrangler.jsonc',
      },
    ]);

    const template = templates.find((t) => t.name === answers.template);
    if (!template) {
      console.error(chalk.red(`Template not found: ${answers.template}`));
      process.exit(1);
    }

    try {
      const content = fs.readFileSync(template.file, 'utf8');
      fs.writeFileSync(answers.output, content);
      console.log(
        chalk.green(`Configuration created from template '${template.name}' at ${answers.output}`)
      );
    } catch (err) {
      console.error(chalk.red(`Error creating configuration: ${err.message}`));
      process.exit(1);
    }
  });

/**
 * Command to validate a configuration file
 */
program
  .command('validate <file>')
  .description('Validate a configuration file')
  .option('--format <format>', 'Output format (text|json|github)', 'text')
  .option('--exit-code', 'Exit with code 1 if validation fails')
  .option('--env <environment>', 'Apply environment overrides before validation')
  .action((file, options) => {
    try {
      // Read and parse the file - handling JSON with comments
      const content = fs.readFileSync(file, 'utf8');
      const config = JSON.parse(
        content
          // Remove line comments
          .replace(/\/\/.*$/gm, '')
          // Remove block comments
          .replace(/\/\*[\s\S]*?\*\//g, '')
      );

      // Apply environment overrides if requested
      const finalConfig = options.env ? applyEnvironmentOverrides(config, options.env) : config;

      // Validate the config
      const errors = validateConfig(finalConfig);

      // Format and output errors
      const formatter = formatters[options.format] || formatters.text;
      if (errors.length > 0) {
        console.log(formatter(errors));
        if (options.exitCode) {
          process.exit(1);
        }
      } else {
        if (options.format === 'json') {
          console.log('[]');
        } else if (options.format === 'github') {
          // No output for GitHub format when there are no errors
        } else {
          console.log(chalk.green('Configuration is valid.'));
        }
      }
    } catch (err) {
      console.error(chalk.red(`Error validating configuration: ${err.message}`));
      process.exit(1);
    }
  });

/**
 * Command to convert configuration to JSON format
 */
program
  .command('convert <inputFile> <outputFile>')
  .description(
    'Convert configuration to JSON format'
  )
  .option('--no-comments', 'Remove comments from output file')
  .option('--no-color', 'Disable color output')
  .action(async (inputFile, outputFile, options) => {
    try {
      // Read the input file
      const fileContent = fs.readFileSync(inputFile, 'utf8');
      let config;

      // Parse input - assuming only JSON support
      try {
        // Handle JSONC (JSON with comments)
        config = JSON.parse(fileContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''));
      } catch (err) {
        console.error(chalk.red(`Error parsing JSON file: ${err.message}`));
        process.exit(1);
      }

      // Convert to output format - only JSON supported
      let outputContent = '';
      // JSON format with comments
      outputContent = JSON.stringify(config, null, 2);

      // Add comments if requested
      if (options.comments) {
        outputContent = `{
  // Image Resizer Configuration
  // Generated on ${new Date().toISOString()}
  // ---
${outputContent.substring(1)}`;
      }

      // Write to output file
      fs.writeFileSync(outputFile, outputContent);
      console.log(chalk.green(`Configuration converted and saved to ${outputFile}`));
    } catch (err) {
      console.error(chalk.red(`Error converting configuration: ${err.message}`));
      process.exit(1);
    }
  });

/**
 * Command to migrate configuration from older formats
 */
program
  .command('migrate <inputFile> <outputFile>')
  .description('Migrate configuration from older formats to current format')
  .option('--no-comments', 'Remove comments from output file')
  .option('--no-color', 'Disable color output')
  .action(async (inputFile, outputFile, options) => {
    try {
      // Read and parse the input file
      const fileContent = fs.readFileSync(inputFile, 'utf8');
      const config = JSON.parse(
        fileContent
          // Remove line comments
          .replace(/\/\/.*$/gm, '')
          // Remove block comments
          .replace(/\/\*[\s\S]*?\*\//g, '')
      );

      // Perform migrations
      const migratedConfig = migrateConfig(config);

      // Generate output
      let outputContent = JSON.stringify(migratedConfig, null, 2);
      if (options.comments) {
        outputContent = `{
  // Image Resizer Configuration (Migrated)
  // Generated on ${new Date().toISOString()}
  // ---
${outputContent.substring(1)}`;
      }

      // Write to output file
      fs.writeFileSync(outputFile, outputContent);
      console.log(
        chalk.green(`Configuration migrated and saved to ${outputFile}`)
      );
    } catch (err) {
      console.error(chalk.red(`Error migrating configuration: ${err.message}`));
      process.exit(1);
    }
  });

/**
 * Migrate configuration from older formats to current format
 * @param config Old configuration
 * @returns Migrated configuration
 */
function migrateConfig(config) {
  const result = { ...config };

  // Ensure compatibility_date is set
  if (!result.compatibility_date) {
    result.compatibility_date = new Date().toISOString().split('T')[0];
  }

  // Update deprecated properties
  if (result.workers_dev !== undefined) {
    console.log(chalk.yellow('Migrating deprecated property: workers_dev'));
    delete result.workers_dev;
  }

  // Convert old routes format to new format
  if (result.routes && Array.isArray(result.routes)) {
    console.log(chalk.yellow('Migrating routes format'));
    result.routes = result.routes.map((route) => {
      if (typeof route === 'string') {
        return { pattern: route };
      }
      return route;
    });
  }

  // Convert old kv_namespaces format if needed
  if (result.kv_namespaces && Array.isArray(result.kv_namespaces)) {
    console.log(chalk.yellow('Migrating KV namespaces format'));
    result.kv_namespaces = result.kv_namespaces.map((ns) => {
      if (typeof ns === 'string') {
        return { binding: ns, id: 'placeholder-id' };
      }
      return ns;
    });
  }

  return result;
}

// Parse command line arguments
program.name('config-cli').description('Configuration management tool for Image Resizer').version('1.0.0');

// Display help if no arguments
if (process.argv.length <= 2) {
  program.help();
}

program.parse();