<?php
if (!defined('ABSPATH')) {
    exit;
}

// Check user capabilities
if (!current_user_can('manage_options')) {
    wp_die(__('You do not have sufficient permissions to access this page.', 'mappinner'));
}

// Get all maps
global $wpdb;
$table_name = $wpdb->prefix . 'mappinner_maps';
$maps = $wpdb->get_results("SELECT * FROM $table_name ORDER BY created_at DESC");
?>

<div class="wrap">
    <h1 class="wp-heading-inline"><?php _e('Image Maps', 'mappinner'); ?></h1>
    <a href="<?php echo esc_url(admin_url('admin.php?page=mappinner-new')); ?>" class="page-title-action"><?php _e('Add New', 'mappinner'); ?></a>
    
    <hr class="wp-header-end">

    <?php if (isset($_GET['message']) && $_GET['message'] === 'saved'): ?>
        <div class="notice notice-success is-dismissible">
            <p><?php _e('Map saved successfully.', 'mappinner'); ?></p>
        </div>
    <?php endif; ?>

    <?php if (!empty($maps)): ?>
        <table class="wp-list-table widefat fixed striped">
            <thead>
                <tr>
                    <th scope="col"><?php _e('Title', 'mappinner'); ?></th>
                    <th scope="col"><?php _e('Shortcode', 'mappinner'); ?></th>
                    <th scope="col"><?php _e('Created', 'mappinner'); ?></th>
                    <th scope="col"><?php _e('Actions', 'mappinner'); ?></th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($maps as $map): ?>
                    <tr>
                        <td>
                            <strong>
                                <a href="<?php echo esc_url(admin_url('admin.php?page=mappinner-new&id=' . $map->id)); ?>">
                                    <?php echo esc_html($map->title); ?>
                                </a>
                            </strong>
                        </td>
                        <td>
                            <code>[image_map id="<?php echo esc_attr($map->id); ?>"]</code>
                            <button type="button" class="button button-small copy-shortcode" data-shortcode='[image_map id="<?php echo esc_attr($map->id); ?>"]'>
                                <?php _e('Copy', 'mappinner'); ?>
                            </button>
                        </td>
                        <td>
                            <?php echo esc_html(date_i18n(get_option('date_format') . ' ' . get_option('time_format'), strtotime($map->created_at))); ?>
                        </td>
                        <td>
                            <a href="<?php echo esc_url(admin_url('admin.php?page=mappinner-new&id=' . $map->id)); ?>" class="button button-small">
                                <?php _e('Edit', 'mappinner'); ?>
                            </a>
                            <button type="button" class="button button-small button-link-delete delete-map" data-id="<?php echo esc_attr($map->id); ?>">
                                <?php _e('Delete', 'mappinner'); ?>
                            </button>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    <?php else: ?>
        <div class="notice notice-info">
            <p><?php _e('No image maps found. Click "Add New" to create your first map!', 'mappinner'); ?></p>
        </div>
    <?php endif; ?>

    <div id="mappinner-shortcode-help" class="postbox" style="margin-top: 20px;">
        <h3 class="hndle"><span><?php _e('How to Use', 'mappinner'); ?></span></h3>
        <div class="inside">
            <p><?php _e('Use this shortcode to display your image map:', 'mappinner'); ?></p>
            <code>[image_map id="YOUR_MAP_ID"]</code>
            
            <h4><?php _e('Instructions:', 'mappinner'); ?></h4>
            <ol>
                <li><?php _e('Create a new map using the "Add New" button', 'mappinner'); ?></li>
                <li><?php _e('Upload an image and add hotspots', 'mappinner'); ?></li>
                <li><?php _e('Save your map', 'mappinner'); ?></li>
                <li><?php _e('Copy the shortcode and paste it into any post or page', 'mappinner'); ?></li>
            </ol>
            
            <p class="description"><?php _e('Replace "YOUR_MAP_ID" with the ID of your map from the table above.', 'mappinner'); ?></p>
        </div>
    </div>
</div>

<script>
jQuery(document).ready(function($) {
    // Copy shortcode functionality
    $('.copy-shortcode').on('click', function() {
        const shortcode = $(this).data('shortcode');
        navigator.clipboard.writeText(shortcode).then(() => {
            const $button = $(this);
            $button.text('Copied!');
            setTimeout(() => {
                $button.text('Copy');
            }, 2000);
        });
    });

    // Delete map functionality
    $('.delete-map').on('click', function() {
        if (!confirm('Are you sure you want to delete this map?')) {
            return;
        }

        const mapId = $(this).data('id');
        const $row = $(this).closest('tr');

        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: {
                action: 'mappinner_delete_map',
                nonce: '<?php echo wp_create_nonce("mappinner_nonce"); ?>',
                map_id: mapId
            },
            success: function(response) {
                if (response.success) {
                    $row.fadeOut(function() {
                        $row.remove();
                        if ($('tbody tr').length === 0) {
                            location.reload();
                        }
                    });
                } else {
                    alert(response.data.message);
                }
            }
        });
    });
});
</script>