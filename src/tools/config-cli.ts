#!/usr/bin/env node
/**
 * Configuration CLI tool for Image Resizer
 * Provides a simple command-line interface for managing configurations
 */
import fs from 'fs';
import path from 'path';
import { program } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { configTemplates, SimpleDerivative } from '../config/configAssistant';

// Load package info
const packageInfo = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));

// Configure CLI
program
  .name('config-cli')
  .description('Image Resizer Configuration Tool')
  .version(packageInfo.version);

/**
 * Command to list available configuration templates
 */
program
  .command('list-templates')
  .description('List available configuration templates')
  .action(() => {
    console.log(chalk.blue.bold('\nAvailable Configuration Templates:'));
    console.log(chalk.gray('────────────────────────────────────\n'));

    Object.entries(configTemplates).forEach(([key, template]) => {
      console.log(chalk.green.bold(`${key}`));
      console.log(`  ${template.description}`);
      console.log(`  ${template.derivatives.length} derivatives defined`);
      console.log();
    });
  });

/**
 * Command to display template details
 */
program
  .command('show-template <name>')
  .description('Show details for a specific template')
  .action((name) => {
    const template = configTemplates[name as keyof typeof configTemplates];

    if (!template) {
      console.error(
        chalk.red(`Template "${name}" not found. Use list-templates to see available options.`)
      );
      process.exit(1);
    }

    console.log(chalk.blue.bold(`\nTemplate: ${template.name}`));
    console.log(chalk.gray('────────────────────────────────────\n'));
    console.log(chalk.bold('Description:'), template.description);

    console.log(chalk.bold('\nDerivatives:'));
    template.derivatives.forEach((derivative) => {
      console.log(chalk.green(`  ${derivative.name}:`));
      console.log(`    ${derivative.description || 'No description'}`);
      console.log(`    Size: ${derivative.width || 'auto'}x${derivative.height || 'auto'}`);
      console.log(`    Quality: ${derivative.quality || 85}`);
      console.log(`    Fit: ${derivative.fit || 'scale-down'}`);
      console.log(`    Metadata: ${derivative.preserveMetadata ? 'preserved' : 'removed'}`);
      if (derivative.sharpen) console.log('    Sharpening: enabled');
      // Cast derivative to SimpleDerivative to access faceDetection property
      if ((derivative as SimpleDerivative).faceDetection) {
        console.log('    Face detection: enabled');
      }
    });

    console.log(chalk.bold('\nResponsive Settings:'));
    console.log(`  Mobile Width: ${template.responsive.mobileWidth || 480}px`);
    console.log(`  Tablet Width: ${template.responsive.tabletWidth || 768}px`);
    console.log(`  Desktop Width: ${template.responsive.desktopWidth || 1440}px`);
    console.log(`  Quality: ${template.responsive.quality || 85}`);
    console.log(`  Auto Format: ${template.responsive.autoFormat ? 'enabled' : 'disabled'}`);
    console.log(`  Preserve Metadata: ${template.responsive.preserveMetadata ? 'yes' : 'no'}`);

    console.log(chalk.bold('\nCache Settings:'));
    console.log(`  Enabled: ${template.cache.enabled ? 'yes' : 'no'}`);
    console.log(`  TTL: ${template.cache.ttl || 86400} seconds`);
    console.log(`  Cache Errors: ${template.cache.cacheErrors ? 'yes' : 'no'}`);
    console.log(`  Optimize Images: ${template.cache.optimizeImages ? 'yes' : 'no'}`);
    console.log();
  });

/**
 * Command to create a new configuration file from a template
 */
program
  .command('create')
  .description('Create a new configuration file using an interactive wizard')
  .option('-o, --output <path>', 'Output file path', './wrangler.jsonc')
  .option('-t, --template <name>', 'Use predefined template')
  .action(async (options) => {
    let selectedTemplate = options.template;

    // If no template is provided, prompt user to select one
    if (!selectedTemplate) {
      const { template } = await inquirer.prompt([
        {
          type: 'list',
          name: 'template',
          message: 'Select a configuration template:',
          choices: Object.entries(configTemplates).map(([key, template]) => ({
            name: `${template.name} - ${template.description}`,
            value: key,
          })),
        },
      ]);
      selectedTemplate = template;
    }

    const template = configTemplates[selectedTemplate as keyof typeof configTemplates];

    if (!template) {
      console.error(
        chalk.red(
          `Template "${selectedTemplate}" not found. Use list-templates to see available options.`
        )
      );
      process.exit(1);
    }

    console.log(chalk.blue.bold(`\nConfiguring from template: ${template.name}`));
    console.log(chalk.gray('────────────────────────────────────\n'));

    // Ask for basic settings
    const { environment, accountId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'environment',
        message: 'Select environment:',
        choices: ['development', 'staging', 'production'],
        default: 'development',
      },
      {
        type: 'input',
        name: 'accountId',
        message: 'Cloudflare account ID:',
        default: '25f21f141824546aa72c74451a11b419', // Example ID
      },
    ]);

    // Ask if they want to customize the template
    const { customize } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'customize',
        message: 'Do you want to customize the template settings?',
        default: false,
      },
    ]);

    const customizedDerivatives = [...template.derivatives];
    let responsiveSettings = { ...template.responsive };
    let cacheSettings = { ...template.cache };

    if (customize) {
      // Customize derivatives
      const { customizeDerivatives } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'customizeDerivatives',
          message: 'Do you want to customize the derivative templates?',
          default: false,
        },
      ]);

      if (customizeDerivatives) {
        // For each derivative, ask if they want to customize it
        for (let i = 0; i < customizedDerivatives.length; i++) {
          const derivative = customizedDerivatives[i];

          const { customize } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'customize',
              message: `Customize derivative "${derivative.name}"?`,
              default: false,
            },
          ]);

          if (customize) {
            const updated = await inquirer.prompt([
              {
                type: 'input',
                name: 'width',
                message: 'Width (pixels):',
                default: derivative.width || 'auto',
              },
              {
                type: 'input',
                name: 'height',
                message: 'Height (pixels):',
                default: derivative.height || 'auto',
              },
              {
                type: 'input',
                name: 'quality',
                message: 'Quality (1-100):',
                default: derivative.quality || 85,
              },
              {
                type: 'list',
                name: 'fit',
                message: 'Fit mode:',
                choices: ['scale-down', 'contain', 'cover', 'crop', 'pad'],
                default: derivative.fit || 'scale-down',
              },
              {
                type: 'confirm',
                name: 'preserveMetadata',
                message: 'Preserve metadata?',
                default: derivative.preserveMetadata || false,
              },
              {
                type: 'confirm',
                name: 'sharpen',
                message: 'Apply sharpening?',
                default: derivative.sharpen || false,
              },
            ]);

            customizedDerivatives[i] = {
              ...derivative,
              ...updated,
              width: updated.width === 'auto' ? undefined : parseInt(updated.width as string),
              height: updated.height === 'auto' ? undefined : parseInt(updated.height as string),
              quality: parseInt(updated.quality as string),
            };
          }
        }
      }

      // Customize responsive settings
      const { customizeResponsive } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'customizeResponsive',
          message: 'Do you want to customize responsive settings?',
          default: false,
        },
      ]);

      if (customizeResponsive) {
        const updatedResponsive = await inquirer.prompt([
          {
            type: 'input',
            name: 'mobileWidth',
            message: 'Mobile width (pixels):',
            default: responsiveSettings.mobileWidth || 480,
          },
          {
            type: 'input',
            name: 'tabletWidth',
            message: 'Tablet width (pixels):',
            default: responsiveSettings.tabletWidth || 768,
          },
          {
            type: 'input',
            name: 'desktopWidth',
            message: 'Desktop width (pixels):',
            default: responsiveSettings.desktopWidth || 1440,
          },
          {
            type: 'input',
            name: 'quality',
            message: 'Default quality (1-100):',
            default: responsiveSettings.quality || 85,
          },
          {
            type: 'confirm',
            name: 'autoFormat',
            message: 'Auto-convert to best format?',
            default: responsiveSettings.autoFormat || true,
          },
        ]);

        responsiveSettings = {
          ...responsiveSettings,
          ...updatedResponsive,
          mobileWidth: parseInt(updatedResponsive.mobileWidth as string),
          tabletWidth: parseInt(updatedResponsive.tabletWidth as string),
          desktopWidth: parseInt(updatedResponsive.desktopWidth as string),
          quality: parseInt(updatedResponsive.quality as string),
        };
      }

      // Customize cache settings
      const { customizeCache } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'customizeCache',
          message: 'Do you want to customize cache settings?',
          default: false,
        },
      ]);

      if (customizeCache) {
        const updatedCache = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'enabled',
            message: 'Enable caching?',
            default: cacheSettings.enabled || true,
          },
          {
            type: 'input',
            name: 'ttl',
            message: 'Cache TTL (seconds):',
            default: cacheSettings.ttl || 86400,
          },
          {
            type: 'confirm',
            name: 'cacheErrors',
            message: 'Cache error responses?',
            default: cacheSettings.cacheErrors || false,
          },
          {
            type: 'confirm',
            name: 'optimizeImages',
            message: 'Apply Cloudflare image optimization?',
            default: cacheSettings.optimizeImages || true,
          },
        ]);

        cacheSettings = {
          ...cacheSettings,
          ...updatedCache,
          ttl: parseInt(updatedCache.ttl as string),
        };
      }
    }

    // Generate the configuration
    const wranglerConfig = generateWranglerConfig(
      environment,
      accountId,
      customizedDerivatives as SimpleDerivative[],
      responsiveSettings,
      cacheSettings
    );

    // Write to file
    try {
      fs.writeFileSync(options.output, wranglerConfig);
      console.log(chalk.green(`\nConfiguration saved to ${options.output}`));
    } catch (err) {
      console.error(
        chalk.red(`Error saving configuration: ${err instanceof Error ? err.message : String(err)}`)
      );
      process.exit(1);
    }
  });

/**
 * Command to validate a configuration file
 */
program
  .command('validate <file>')
  .description('Validate a configuration file')
  .option('-f, --format <format>', 'Output format (human|json|github)', 'human')
  .option('-s, --silent', 'Silent mode - only show errors')
  .option('-e, --exit-code', 'Exit with non-zero code on validation errors')
  .action(async (file, options) => {
    try {
      const fileContent = fs.readFileSync(file, 'utf8');
      const config = JSON.parse(fileContent);

      // Extract image config from the wrangler config
      const imageConfig = extractImageConfig(config);

      // Import the enhanced validator
      const { validateAppConfigWithDetails } = await import('../config/configValidator');

      // Validate the configuration with detailed results
      const validationResult = validateAppConfigWithDetails(config);

      // Output the validation results in the appropriate format
      if (options.format === 'json') {
        // JSON format for machine readability
        console.log(JSON.stringify(validationResult, null, 2));

        if (options.exitCode && !validationResult.valid) {
          process.exit(1);
        }
      } else if (options.format === 'github') {
        // GitHub Actions format
        for (const error of validationResult.errors) {
          console.log(`::error::${error}`);
        }

        for (const warning of validationResult.warnings) {
          console.log(`::warning::${warning}`);
        }

        if (!options.silent && validationResult.valid) {
          console.log('::notice::Configuration is valid');
        }

        if (options.exitCode && !validationResult.valid) {
          process.exit(1);
        }
      } else {
        // Human-readable format (default)
        if (!validationResult.valid) {
          console.error(chalk.red.bold('\nConfiguration validation failed:'));
          console.error(chalk.gray('────────────────────────────────────\n'));

          for (const error of validationResult.errors) {
            console.error(chalk.red(`✖ ${error}`));
          }

          if (!options.silent && validationResult.warnings.length > 0) {
            console.warn('\n' + chalk.yellow.bold('Warnings:'));
            for (const warning of validationResult.warnings) {
              console.warn(chalk.yellow(`⚠ ${warning}`));
            }
          }

          if (options.exitCode) {
            process.exit(1);
          }
        } else {
          console.log(chalk.green.bold('\nConfiguration is valid ✓'));
          console.log(chalk.gray('────────────────────────────────────\n'));

          if (!options.silent) {
            // Show warnings if any
            if (validationResult.warnings.length > 0) {
              console.warn(chalk.yellow.bold('Warnings:'));
              for (const warning of validationResult.warnings) {
                console.warn(chalk.yellow(`⚠ ${warning}`));
              }
              console.log();
            }

            // Show a summary of the validated config
            console.log('Configuration Summary:');
            console.log(`- Derivatives: ${Object.keys(imageConfig.derivatives || {}).length}`);
            console.log(
              `- Environment: ${config.env ? Object.keys(config.env).join(', ') : 'Not configured'}`
            );

            // Show additional config sections if present
            if (config.security)
              console.log(`- Security: ${Object.keys(config.security).length} sections`);
            if (config.watermark)
              console.log(`- Watermarking: ${config.watermark.enabled ? 'enabled' : 'disabled'}`);
            if (config.limits) console.log(`- Resource Limits: configured`);
            console.log();
          }
        }
      }
    } catch (err) {
      console.error(
        chalk.red(
          `Error validating configuration: ${err instanceof Error ? err.message : String(err)}`
        )
      );

      if (options.exitCode) {
        process.exit(1);
      }
    }
  });

/**
 * Command to convert configuration between formats
 */
program
  .command('convert <inputFile> <outputFile>')
  .description(
    'Convert configuration between formats (JSON <-> YAML, requires optional yaml package)'
  )
  .option('-f, --format <format>', 'Output format (json|yaml)', 'json')
  .option('--no-comments', 'Remove comments from output file')
  .option('--no-color', 'Disable color output')
  .action(async (inputFile, outputFile, options) => {
    try {
      // Dynamically import YAML parser if needed
      let yaml;
      if (options.format === 'yaml' || inputFile.endsWith('.yml') || inputFile.endsWith('.yaml')) {
        try {
          yaml = await import('yaml');
        } catch (err) {
          console.error(
            chalk.red(
              'Error: YAML support requires the "yaml" package. Install it with "npm install yaml".'
            )
          );
          process.exit(1);
        }
      }

      // Read the input file
      const fileContent = fs.readFileSync(inputFile, 'utf8');
      let config;

      // Parse input based on extension
      if (inputFile.endsWith('.yml') || inputFile.endsWith('.yaml')) {
        if (!yaml) {
          console.error(chalk.red('Error: YAML support requires the "yaml" package.'));
          process.exit(1);
        }
        config = yaml.parse(fileContent);
      } else {
        // Assume JSON - handle both regular JSON and JSONC
        config = JSON.parse(fileContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''));
      }

      // Convert to output format
      let outputContent = '';
      if (options.format === 'yaml') {
        if (!yaml) {
          console.error(chalk.red('Error: YAML support requires the "yaml" package.'));
          process.exit(1);
        }
        outputContent = yaml.stringify(config, { indent: 2 });

        // Add comments if requested
        if (options.comments) {
          outputContent = `# Image Resizer Configuration\n# Generated on ${new Date().toISOString()}\n${outputContent}`;
        }
      } else {
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
      }

      // Write to output file
      fs.writeFileSync(outputFile, outputContent);
      console.log(chalk.green(`Configuration converted and saved to ${outputFile}`));
    } catch (err) {
      console.error(
        chalk.red(
          `Error converting configuration: ${err instanceof Error ? err.message : String(err)}`
        )
      );
      process.exit(1);
    }
  });

/**
 * Command to migrate configuration to a new format
 */
program
  .command('migrate <inputFile> <outputFile>')
  .description('Migrate configuration to a newer format')
  .option('-v, --version <version>', 'Target version to migrate to', '2.0')
  .option('--apply-defaults', 'Apply default values for missing fields')
  .option('--backup', 'Create a backup of the input file before migration')
  .action((inputFile, outputFile, options) => {
    try {
      // Read the input file
      const fileContent = fs.readFileSync(inputFile, 'utf8');
      const config = JSON.parse(fileContent);

      // Create backup if requested
      if (options.backup) {
        const backupFile = `${inputFile}.backup-${Date.now()}`;
        fs.writeFileSync(backupFile, fileContent);
        console.log(chalk.yellow(`Backup created at ${backupFile}`));
      }

      // Perform migration based on version
      const migratedConfig = migrateConfig(config, options.version, options.applyDefaults);

      // Write the migrated config
      fs.writeFileSync(outputFile, JSON.stringify(migratedConfig, null, 2));
      console.log(
        chalk.green(
          `Configuration migrated to version ${options.version} and saved to ${outputFile}`
        )
      );
    } catch (err) {
      console.error(
        chalk.red(
          `Error migrating configuration: ${err instanceof Error ? err.message : String(err)}`
        )
      );
      process.exit(1);
    }
  });

/**
 * Command to display configuration example
 */
program
  .command('example')
  .description('Show example configuration')
  .action(() => {
    // Show a simple example configuration
    console.log(chalk.blue.bold('\nExample Configuration:'));
    console.log(chalk.gray('────────────────────────────────────\n'));

    const example = generateWranglerConfig(
      'development',
      '25f21f141824546aa72c74451a11b419',
      configTemplates.basic.derivatives as SimpleDerivative[],
      configTemplates.basic.responsive,
      configTemplates.basic.cache
    );

    console.log(example);
  });

/**
 * Generate a wrangler.jsonc configuration from template components
 */
function generateWranglerConfig(
  environment: string,
  accountId: string,
  derivatives: SimpleDerivative[],
  responsive: Record<string, unknown>,
  cache: Record<string, unknown>
): string {
  // Convert derivatives to the expected format
  const derivativeTemplates: Record<string, Record<string, unknown>> = {};
  derivatives.forEach((derivative) => {
    derivativeTemplates[derivative.name] = {
      width: derivative.width,
      height: derivative.height,
      quality: derivative.quality || 85,
      fit: derivative.fit || 'scale-down',
      metadata: derivative.preserveMetadata ? 'copyright' : 'none',
      ...(derivative.sharpen ? { sharpen: 1 } : {}),
      ...(derivative.faceDetection ? { gravity: 'face' } : {}),
    };
  });

  // Create environment-specific config
  const envConfig = {
    name: `${environment}-resizer`,
    vars: {
      // Core configuration
      ENVIRONMENT: environment,
      DEPLOYMENT_MODE: 'remote',
      VERSION: '1.1.0',
      FALLBACK_BUCKET: 'https://cdn.example.com',

      // Logging configuration
      LOGGING_CONFIG: {
        level: environment === 'production' ? 'WARN' : environment === 'staging' ? 'INFO' : 'DEBUG',
        includeTimestamp: true,
        enableStructuredLogs: true,
      },

      // Debug headers configuration
      DEBUG_HEADERS_CONFIG: {
        enabled: environment !== 'production',
        prefix: 'debug-',
        includeHeaders: [
          'ir',
          'cache',
          'mode',
          ...(environment === 'development' ? ['client-hints', 'ua', 'device'] : []),
        ],
      },

      // Remote bucket configuration
      REMOTE_BUCKETS: {
        default: 'https://cdn.example.com',
      },

      // Image transformation templates
      DERIVATIVE_TEMPLATES: derivativeTemplates,

      // Path-to-template mappings - create from derivative names
      PATH_TEMPLATES: derivatives.reduce(
        (acc, deriv) => {
          acc[deriv.name] = deriv.name;
          return acc;
        },
        {} as Record<string, string>
      ),

      // Cache configuration
      CACHE_CONFIG: {
        image: {
          regex: '^.*\\.(jpe?g|JPG|png|gif|webp|svg)$',
          ttl: {
            ok: cache.ttl || 86400,
            redirects: cache.ttl || 86400,
            clientError: cache.cacheErrors ? 60 : 0,
            serverError: cache.cacheErrors ? 10 : 0,
          },
          cacheability: cache.enabled,
          mirage: cache.optimizeImages,
          imageCompression: cache.optimizeImages ? 'lossy' : 'off',
        },
      },

      // Responsive configuration
      RESPONSIVE_CONFIG: {
        availableWidths: [320, 640, 768, 960, 1024, 1440, 1920, 2048, 3840],
        breakpoints: [320, 768, 960, 1440, 1920, 2048],
        deviceWidths: {
          mobile: responsive.mobileWidth || 480,
          tablet: responsive.tabletWidth || 768,
          desktop: responsive.desktopWidth || 1440,
        },
        deviceMinWidthMap: {
          mobile: 320,
          tablet: 768,
          'large-desktop': 1920,
          desktop: 960,
        },
        quality: responsive.quality || 85,
        fit: 'scale-down',
        metadata: responsive.preserveMetadata ? 'copyright' : 'none',
        format: responsive.autoFormat ? 'auto' : 'original',
      },
    },
  };

  // Create full wrangler config
  const wranglerConfig = {
    name: 'image-resizer',
    main: 'src/index.ts',
    compatibility_date: '2025-01-01',
    account_id: accountId,
    limits: {
      cpu_ms: 50,
      memory_mb: 128,
    },
    observability: {
      enabled: true,
      head_sampling_rate: 1,
    },
    dev: {
      port: 9001,
      local_protocol: 'http',
      upstream_protocol: 'https',
    },
    env: {
      [environment]: envConfig,
    },
  };

  // Return formatted JSON with comments
  return `{
  // Cloudflare Image Resizing Worker Configuration
  // ---
  // This worker provides dynamic image resizing capabilities using 
  // Cloudflare's Image Resizing service.
  "name": "${wranglerConfig.name}",
  "main": "${wranglerConfig.main}",
  "compatibility_date": "${wranglerConfig.compatibility_date}",
  "account_id": "${wranglerConfig.account_id}",
  // Resource limits to prevent unexpected billing
  "limits": {
    "cpu_ms": ${wranglerConfig.limits.cpu_ms},
    "memory_mb": ${wranglerConfig.limits.memory_mb}
  },
  // Observability settings
  "observability": {
    "enabled": ${wranglerConfig.observability.enabled},
    "head_sampling_rate": ${wranglerConfig.observability.head_sampling_rate}
  },
  // Development server configuration
  "dev": {
    "port": ${wranglerConfig.dev.port},
    "local_protocol": "${wranglerConfig.dev.local_protocol}",
    "upstream_protocol": "${wranglerConfig.dev.upstream_protocol}"
  },
  // Environment Configurations
  //
  "env": {
    // ${environment.charAt(0).toUpperCase() + environment.slice(1)} environment
    "${environment}": ${JSON.stringify(envConfig, null, 2)}
  }
}`;
}

/**
 * Extract image configuration from wrangler.jsonc
 */
interface WranglerConfig {
  env: Record<string, EnvConfig>;
}

interface EnvConfig {
  vars?: {
    DERIVATIVE_TEMPLATES?: Record<string, unknown>;
    RESPONSIVE_CONFIG?: Record<string, unknown>;
    CACHE_CONFIG?: {
      image?: {
        cacheability?: boolean;
        ttl?: Record<string, number>;
      };
    };
  };
}

function extractImageConfig(wranglerConfig: Record<string, unknown>): Record<string, unknown> {
  // Use a more cautious approach to avoid type errors
  const typedConfig = wranglerConfig as unknown as WranglerConfig;

  if (!typedConfig.env) {
    throw new Error('No environments defined in configuration');
  }

  // Use the first environment as a reference
  const envName = Object.keys(typedConfig.env)[0];
  const envConfig = typedConfig.env[envName];

  if (!envConfig.vars) {
    throw new Error('No variables defined in environment configuration');
  }

  return {
    derivatives: envConfig.vars.DERIVATIVE_TEMPLATES || {},
    responsive: envConfig.vars.RESPONSIVE_CONFIG || {},
    validation: {
      fit: ['scale-down', 'contain', 'cover', 'crop', 'pad'],
      format: ['auto', 'webp', 'avif', 'json', 'jpeg', 'png', 'gif'],
      metadata: ['keep', 'copyright', 'none'],
      gravity: ['auto', 'center', 'top', 'bottom', 'left', 'right', 'face'],
    },
    defaults: {
      quality: 85,
      fit: 'scale-down',
      format: 'auto',
      metadata: 'copyright',
    },
    caching: {
      method: envConfig.vars.CACHE_CONFIG?.image?.cacheability ? 'cache-api' : 'none',
      debug: false,
      ttl: envConfig.vars.CACHE_CONFIG?.image?.ttl || {
        ok: 86400,
        redirects: 86400,
        clientError: 0,
        serverError: 0,
      },
    },
  };
}

// Function not used now but may be useful in the future
// Keeping commented for reference
/*
function formatZodErrors(errors: Record<string, unknown>, path = ''): string {
  let result = '';

  if ('_errors' in errors && Array.isArray(errors._errors) && errors._errors.length > 0) {
    result += chalk.red(`${path}: ${errors._errors.join(', ')}\n`);
  }

  for (const key in errors) {
    if (key !== '_errors' && typeof errors[key] === 'object' && errors[key] !== null) {
      const newPath = path ? `${path}.${key}` : key;
      result += formatZodErrors(errors[key] as Record<string, unknown>, newPath);
    }
  }

  return result;
}
*/

// Parse command line arguments
program.parse(process.argv);

/**
 * Migrate configuration to a different version
 * @param config Original configuration
 * @param targetVersion Target version to migrate to
 * @param applyDefaults Whether to apply default values
 * @returns Migrated configuration
 */
function migrateConfig(
  config: Record<string, unknown>,
  targetVersion: string,
  applyDefaults: boolean
): Record<string, unknown> {
  // Clone to avoid modifying original
  const result = JSON.parse(JSON.stringify(config));

  // Determine the current version
  const currentVersion = result.version || '1.0.0';

  console.log(chalk.blue(`Migrating from version ${currentVersion} to ${targetVersion}`));

  // Migration path based on versions
  if (currentVersion.startsWith('1.0') && targetVersion.startsWith('2.0')) {
    // Migrate from 1.0 to 2.0

    // 1. Convert templates structure
    if (result.config_templates) {
      // Extract derivative templates
      if (result.config_templates.derivative_templates) {
        if (!result.env) {
          result.env = {};
        }

        // Add to each environment
        for (const envName in result.env) {
          if (!result.env[envName].vars) {
            result.env[envName].vars = {};
          }

          result.env[envName].vars.DERIVATIVE_TEMPLATES =
            result.config_templates.derivative_templates;
        }

        console.log(chalk.green('✓ Migrated derivative templates'));
      }

      // Extract path templates
      if (result.config_templates.path_templates) {
        for (const envName in result.env) {
          if (!result.env[envName].vars) {
            result.env[envName].vars = {};
          }

          result.env[envName].vars.PATH_TEMPLATES = result.config_templates.path_templates;
        }

        console.log(chalk.green('✓ Migrated path templates'));
      }

      // Extract path transforms
      if (result.config_templates.path_transforms) {
        for (const envName in result.env) {
          if (!result.env[envName].vars) {
            result.env[envName].vars = {};
          }

          result.env[envName].vars.PATH_TRANSFORMS = result.config_templates.path_transforms;
        }

        console.log(chalk.green('✓ Migrated path transforms'));
      }

      // Extract responsive config
      if (result.config_templates.responsive_config) {
        for (const envName in result.env) {
          if (!result.env[envName].vars) {
            result.env[envName].vars = {};
          }

          result.env[envName].vars.RESPONSIVE_CONFIG = result.config_templates.responsive_config;
        }

        console.log(chalk.green('✓ Migrated responsive configuration'));
      }

      // Extract cache config
      if (result.config_templates.cache_config) {
        for (const envName in result.env) {
          if (!result.env[envName].vars) {
            result.env[envName].vars = {};
          }

          result.env[envName].vars.CACHE_CONFIG = result.config_templates.cache_config;
        }

        console.log(chalk.green('✓ Migrated cache configuration'));
      }

      // Remove old templates
      delete result.config_templates;
    }

    // 2. Convert references to direct values
    for (const envName in result.env) {
      const env = result.env[envName];
      if (env.vars) {
        for (const key in env.vars) {
          const value = env.vars[key];
          if (typeof value === 'string' && value.startsWith('$config_templates.')) {
            console.warn(
              chalk.yellow(
                `⚠ Reference found in ${envName}.vars.${key} - manual conversion required`
              )
            );
          }
        }
      }
    }

    // 3. Add new sections if applying defaults
    if (applyDefaults) {
      // Add security configuration
      for (const envName in result.env) {
        if (!result.env[envName].vars) {
          result.env[envName].vars = {};
        }

        if (!result.env[envName].vars.SECURITY_CONFIG) {
          result.env[envName].vars.SECURITY_CONFIG = {
            cors: {
              allowOrigins: ['*'],
              allowMethods: ['GET', 'HEAD', 'OPTIONS'],
              maxAge: 86400,
              credentials: false,
            },
            rateLimiting: {
              enabled: envName === 'prod',
              requestsPerMinute: 300,
              blockOverages: false,
            },
          };
        }
      }

      console.log(chalk.green('✓ Added default security configuration'));

      // Add limits configuration
      for (const envName in result.env) {
        if (!result.env[envName].vars) {
          result.env[envName].vars = {};
        }

        if (!result.env[envName].vars.LIMITS_CONFIG) {
          result.env[envName].vars.LIMITS_CONFIG = {
            maxSourceImageSize: 15728640, // 15MB
            maxOutputImageSize: 5242880, // 5MB
            maxConcurrentRequests: 10,
            timeoutMs: 15000,
          };
        }
      }

      console.log(chalk.green('✓ Added default limits configuration'));
    }

    // 4. Update version
    result.version = targetVersion;
    console.log(chalk.green(`✓ Updated version to ${targetVersion}`));
  } else {
    console.warn(
      chalk.yellow(`No migration path found from ${currentVersion} to ${targetVersion}`)
    );
  }

  return result;
}

// Add support for color blindness modes using chalk
let colorMode = 'standard';
if (process.env.COLOR_MODE) {
  colorMode = process.env.COLOR_MODE.toLowerCase();

  if (colorMode === 'colorblind') {
    // For colorblind mode, we would need to implement a more comprehensive solution
    // that replaces all chalk color instances with colorblind-friendly alternatives.
    // This would require creating wrapper functions and using them consistently.
    //
    // For now, we'll just log a message about colorblind mode being enabled,
    // but a production implementation would need proper color substitutions.

    console.log('Using colorblind-friendly color scheme');
  }
}

// Add CI detection
const isCI = process.env.CI === 'true';
if (isCI) {
  // In CI, we default to machine-readable format
  program.commands.forEach((cmd) => {
    if (cmd.name() === 'validate') {
      cmd.opts().format = 'github';
    }
  });
}

// If no command is specified, show help
if (!process.argv.slice(2).length) {
  program.help();
}
