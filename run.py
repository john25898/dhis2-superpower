import matplotlib.pyplot as plt
import numpy as np
import matplotlib.patches as patches

# General style configuration
plt.rcParams['font.family'] = 'sans-serif'
colors = {'Male': '#0b0b45', 'Female': '#e64c8a'} # Exact Dark Blue and Pink
age_groups = ['Under 1', '01 to 04', '05 to 09', '10 to 14', '15 to 17']

# Mock Data approximated from the charts
calhiv_male = np.array([50, 1200, 3900, 8500, 7500])
calhiv_female = np.array([50, 1300, 4000, 8800, 8200])

ovc_male = np.array([10, 300, 2200, 5200, 5000])
ovc_female = np.array([10, 400, 2400, 5800, 5400])

# Initialize figure with a specific size to mimic the wide dashboard layout
fig, axs = plt.subplots(1, 2, figsize=(16, 7))
fig.patch.set_facecolor('white')

def draw_exact_pyramid(ax, male_data, female_data, title, max_x, x_step):
    y = np.arange(len(age_groups))
    height = 0.35 # Bar thickness
    
    # 1. Background Grid
    ax.grid(axis='x', color='#e8e8e8', linestyle='-', linewidth=1, zorder=0)
    ax.set_axisbelow(True) # Ensure grid stays behind the bars
    
    # 2. Draw Horizontal Bars (Male is negative to push it left of 0)
    ax.barh(y, -male_data, height, color=colors['Male'], zorder=3)
    ax.barh(y, female_data, height, color=colors['Female'], zorder=3)
    
    # 3. Center Zero Line
    ax.axvline(0, color='lightgray', linewidth=1.5, zorder=4)
    
    # 4. X-Axis Configuration (Symmetrical around 0)
    ticks = np.arange(-max_x, max_x + 1, x_step)
    ax.set_xticks(ticks)
    # Convert negative ticks to absolute strings for display
    ax.set_xticklabels([str(abs(int(t))) for t in ticks], color='#666666', fontsize=9)
    ax.set_xlabel('Number Of Patients', color='#666666', fontsize=10, labelpad=10)
    ax.tick_params(axis='x', bottom=False)
    
    # 5. Y-Axis Configuration (Labels displayed on BOTH left and right sides)
    ax.set_yticks(y)
    ax.set_yticklabels(age_groups, color='#666666', fontsize=9)
    ax.tick_params(axis='y', left=False, right=False, labelleft=True, labelright=True)
    ax.set_ylim(-0.5, len(age_groups) - 0.5)
    
    # Remove default matplotlib spines/borders
    for spine in ax.spines.values():
        spine.set_visible(False)
        
    # 6. UI Framing: Outer Border
    # We use transAxes to draw shapes relative to the plot boundaries. 
    # Extends slightly beyond 0 and 1 to encapsulate the labels.
    border = patches.Rectangle((-0.18, -0.18), 1.36, 1.4, transform=ax.transAxes, 
                               fill=False, edgecolor='#d3d3d3', linewidth=1, clip_on=False)
    ax.add_patch(border)
    
    # 7. UI Framing: Gray Header Block
    header = patches.Rectangle((-0.18, 1.07), 1.36, 0.15, transform=ax.transAxes, 
                               facecolor='#ececec', edgecolor='#d3d3d3', linewidth=1, clip_on=False)
    ax.add_patch(header)
    
    # Header Title Text
    ax.text(0.5, 1.145, title, transform=ax.transAxes, ha='center', va='center', 
            fontsize=11, color='#333333')
            
    # 8. Legend Generation
    # Add circular mock scatter points specifically for the legend to match the UI
    ax.plot([], [], 'o', color=colors['Female'], label='Female', markersize=8)
    ax.plot([], [], 'o', color=colors['Male'], label='Male', markersize=8)
    
    handles, labels = ax.get_legend_handles_labels()
    ax.legend(handles, labels, loc='upper left', bbox_to_anchor=(-0.05, 1.05), 
              ncol=2, frameon=False, handletextpad=0.5, columnspacing=1.5, fontsize=10)
    
    # 9. Hamburger Menu Icon (Top Right)
    ax.text(1.13, 1.02, '≡', transform=ax.transAxes, ha='center', va='center', 
            fontsize=22, color='#555555', weight='bold')

# Render Left Chart
draw_exact_pyramid(axs[0], calhiv_male, calhiv_female, 
                   "DISTRIBUTION OF CALHIV PATIENTS BY AGE AND SEX", 
                   max_x=10000, x_step=2000)

# Render Right Chart
draw_exact_pyramid(axs[1], ovc_male, ovc_female, 
                   "DISTRIBUTION OF OVC PATIENTS BY AGE AND SEX", 
                   max_x=6000, x_step=1000)

# Final Layout Adjustments to accommodate the drawn boundaries
plt.subplots_adjust(left=0.08, right=0.92, bottom=0.15, top=0.78, wspace=0.35)

# Display the charts
plt.show()