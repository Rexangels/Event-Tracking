"""
Management command to create sample form templates for INEHSS.
"""

from django.core.management.base import BaseCommand
from inehss.models import FormTemplate


class Command(BaseCommand):
    help = 'Creates sample form templates for INEHSS testing'

    def handle(self, *args, **options):
        # Public: General Hazard Report
        FormTemplate.objects.update_or_create(
            name='General Hazard Report',
            defaults={
                'description': 'Report any environmental hazard (pollution, illegal dumping, chemical spills, etc.)',
                'form_type': 'public',
                'is_active': True,
                'schema': [
                    {
                        'name': 'hazard_type',
                        'type': 'select',
                        'label': 'Type of Hazard',
                        'required': True,
                        'options': [
                            {'value': 'air_pollution', 'label': 'Air Pollution'},
                            {'value': 'water_pollution', 'label': 'Water Pollution'},
                            {'value': 'illegal_dumping', 'label': 'Illegal Waste Dumping'},
                            {'value': 'chemical_spill', 'label': 'Chemical Spill'},
                            {'value': 'noise_pollution', 'label': 'Noise Pollution'},
                            {'value': 'other', 'label': 'Other'},
                        ]
                    },
                    {
                        'name': 'description',
                        'type': 'textarea',
                        'label': 'Describe the Hazard',
                        'required': True,
                        'placeholder': 'Please describe what you observed in detail...',
                    },
                    {
                        'name': 'observed_date',
                        'type': 'date',
                        'label': 'When did you observe this?',
                        'required': False,
                    },
                    {
                        'name': 'severity',
                        'type': 'radio',
                        'label': 'How severe does it appear?',
                        'required': True,
                        'options': [
                            {'value': 'low', 'label': 'Low - Minor nuisance'},
                            {'value': 'medium', 'label': 'Medium - Noticeable impact'},
                            {'value': 'high', 'label': 'High - Significant harm'},
                            {'value': 'critical', 'label': 'Critical - Immediate danger'},
                        ]
                    },
                ]
            }
        )
        self.stdout.write(self.style.SUCCESS('Created: General Hazard Report'))

        # Officer: Chemical Site Inspection
        FormTemplate.objects.update_or_create(
            name='Chemical Site Inspection',
            defaults={
                'description': 'Technical inspection form for hazardous chemical storage/handling sites (NESREA Standard)',
                'form_type': 'officer',
                'is_active': True,
                'schema': [
                    {
                        'name': 'facility_name',
                        'type': 'text',
                        'label': 'Facility Name',
                        'required': True,
                    },
                    {
                        'name': 'contact_person',
                        'type': 'text',
                        'label': 'Contact Person',
                        'required': False,
                    },
                    {
                        'name': 'facility_type',
                        'type': 'select',
                        'label': 'Facility Type',
                        'required': True,
                        'options': [
                            {'value': 'warehouse', 'label': 'Warehouse/Storage'},
                            {'value': 'manufacturing', 'label': 'Manufacturing Plant'},
                            {'value': 'distributor', 'label': 'Distributor'},
                            {'value': 'retail', 'label': 'Retail Outlet'},
                            {'value': 'workshop', 'label': 'Informal/Small-scale Workshop'},
                        ]
                    },
                    {
                        'name': 'surrounding_area',
                        'type': 'select',
                        'label': 'Surrounding Area',
                        'required': True,
                        'options': [
                            {'value': 'residential', 'label': 'Residential'},
                            {'value': 'commercial', 'label': 'Commercial'},
                            {'value': 'industrial', 'label': 'Industrial'},
                            {'value': 'agricultural', 'label': 'Agricultural'},
                            {'value': 'sensitive', 'label': 'Sensitive (School/Hospital/Water Source)'},
                        ]
                    },
                    {
                        'name': 'chemical_types',
                        'type': 'multiselect',
                        'label': 'Chemical Types Present',
                        'required': True,
                        'options': [
                            {'value': 'acids', 'label': 'Acids'},
                            {'value': 'alkalis', 'label': 'Alkalis/Bases'},
                            {'value': 'solvents', 'label': 'Organic Solvents'},
                            {'value': 'pesticides', 'label': 'Pesticides/Agrochemicals'},
                            {'value': 'heavy_metals', 'label': 'Heavy Metals (Lead, Mercury, etc.)'},
                            {'value': 'petroleum', 'label': 'Petroleum Products'},
                            {'value': 'unknown', 'label': 'Unknown/Unlabeled'},
                        ]
                    },
                    {
                        'name': 'storage_condition',
                        'type': 'multiselect',
                        'label': 'Storage Condition Issues',
                        'required': False,
                        'options': [
                            {'value': 'leaking', 'label': 'Leaking Containers'},
                            {'value': 'open', 'label': 'Open Containers'},
                            {'value': 'corroded', 'label': 'Corroded Containers'},
                            {'value': 'no_labels', 'label': 'No Labels/Improper Labeling'},
                            {'value': 'improper_stacking', 'label': 'Improper Stacking'},
                            {'value': 'no_secondary', 'label': 'No Secondary Containment'},
                        ]
                    },
                    {
                        'name': 'odor_detected',
                        'type': 'select',
                        'label': 'Odor Detected',
                        'required': True,
                        'options': [
                            {'value': 'none', 'label': 'None'},
                            {'value': 'chemical', 'label': 'Strong Chemical Odor'},
                            {'value': 'burning', 'label': 'Burning Smell'},
                            {'value': 'rotten', 'label': 'Rotten Egg (Sulfur)'},
                            {'value': 'other', 'label': 'Other Unusual Odor'},
                        ]
                    },
                    {
                        'name': 'visual_evidence',
                        'type': 'multiselect',
                        'label': 'Visual Evidence of Contamination',
                        'required': False,
                        'options': [
                            {'value': 'spills', 'label': 'Active Spills'},
                            {'value': 'stained_soil', 'label': 'Stained Soil'},
                            {'value': 'dead_vegetation', 'label': 'Dead/Discolored Vegetation'},
                            {'value': 'corroded_structures', 'label': 'Corroded Building Structures'},
                            {'value': 'runoff', 'label': 'Visible Runoff to Drainage'},
                        ]
                    },
                    {
                        'name': 'risk_level',
                        'type': 'radio',
                        'label': 'Overall Risk Assessment',
                        'required': True,
                        'options': [
                            {'value': 'low', 'label': 'Low - Minor non-compliance'},
                            {'value': 'medium', 'label': 'Medium - Potential environmental risk'},
                            {'value': 'high', 'label': 'High - Active contamination'},
                            {'value': 'critical', 'label': 'Critical - Immediate threat to health'},
                        ]
                    },
                    {
                        'name': 'enforcement_action',
                        'type': 'multiselect',
                        'label': 'Enforcement Action Taken',
                        'required': True,
                        'options': [
                            {'value': 'warning', 'label': 'Verbal Warning'},
                            {'value': 'notice', 'label': 'NESREA Violation Notice Issued'},
                            {'value': 'seal', 'label': 'Site Sealed'},
                            {'value': 'remediation', 'label': 'Remediation Order Given'},
                            {'value': 'sampling', 'label': 'Environmental Sampling Initiated'},
                        ]
                    },
                    {
                        'name': 'findings',
                        'type': 'textarea',
                        'label': 'Detailed Findings',
                        'required': True,
                        'placeholder': 'Document your observations and findings in detail...',
                    },
                ]
            }
        )
        self.stdout.write(self.style.SUCCESS('Created: Chemical Site Inspection'))

        # Officer: Dumpsite Inspection
        FormTemplate.objects.update_or_create(
            name='Dumpsite Inspection',
            defaults={
                'description': 'Hazard surveillance for dumpsites and waste disposal areas',
                'form_type': 'officer',
                'is_active': True,
                'schema': [
                    {
                        'name': 'site_type',
                        'type': 'select',
                        'label': 'Site Classification',
                        'required': True,
                        'options': [
                            {'value': 'official', 'label': 'Official/Approved Landfill'},
                            {'value': 'unofficial', 'label': 'Unofficial/Illegal Dumpsite'},
                            {'value': 'transfer', 'label': 'Waste Transfer Station'},
                        ]
                    },
                    {
                        'name': 'estimated_size',
                        'type': 'select',
                        'label': 'Estimated Site Size',
                        'required': True,
                        'options': [
                            {'value': 'small', 'label': 'Small (< 500 sqm)'},
                            {'value': 'medium', 'label': 'Medium (500 - 2000 sqm)'},
                            {'value': 'large', 'label': 'Large (> 2000 sqm)'},
                        ]
                    },
                    {
                        'name': 'waste_types',
                        'type': 'multiselect',
                        'label': 'Waste Types Observed',
                        'required': True,
                        'options': [
                            {'value': 'municipal', 'label': 'Municipal Solid Waste'},
                            {'value': 'medical', 'label': 'Medical/Healthcare Waste'},
                            {'value': 'ewaste', 'label': 'Electronic Waste (E-Waste)'},
                            {'value': 'industrial', 'label': 'Industrial Waste'},
                            {'value': 'construction', 'label': 'Construction Debris'},
                            {'value': 'hazardous', 'label': 'Hazardous Chemical Waste'},
                        ]
                    },
                    {
                        'name': 'burning_activity',
                        'type': 'radio',
                        'label': 'Open Burning Activity',
                        'required': True,
                        'options': [
                            {'value': 'none', 'label': 'None observed'},
                            {'value': 'past', 'label': 'Evidence of past burning'},
                            {'value': 'active', 'label': 'Active burning in progress'},
                        ]
                    },
                    {
                        'name': 'vectors',
                        'type': 'multiselect',
                        'label': 'Disease Vectors Present',
                        'required': False,
                        'options': [
                            {'value': 'rodents', 'label': 'Rodents'},
                            {'value': 'flies', 'label': 'Flies/Insects'},
                            {'value': 'scavengers', 'label': 'Scavengers (Dogs, Birds)'},
                            {'value': 'mosquitoes', 'label': 'Mosquito Breeding (Standing Water)'},
                        ]
                    },
                    {
                        'name': 'leachate',
                        'type': 'checkbox',
                        'label': 'Leachate (liquid runoff) visible',
                        'required': False,
                    },
                    {
                        'name': 'proximity_settlement',
                        'type': 'select',
                        'label': 'Distance to Nearest Settlement',
                        'required': True,
                        'options': [
                            {'value': 'adjacent', 'label': 'Adjacent (< 50m)'},
                            {'value': 'near', 'label': 'Near (50-200m)'},
                            {'value': 'moderate', 'label': 'Moderate (200-500m)'},
                            {'value': 'far', 'label': 'Distant (> 500m)'},
                        ]
                    },
                    {
                        'name': 'findings',
                        'type': 'textarea',
                        'label': 'Detailed Findings',
                        'required': True,
                        'placeholder': 'Document your observations...',
                    },
                    {
                        'name': 'recommendation',
                        'type': 'textarea',
                        'label': 'Recommendations',
                        'required': False,
                        'placeholder': 'Recommended actions...',
                    },
                ]
            }
        )
        self.stdout.write(self.style.SUCCESS('Created: Dumpsite Inspection'))

        self.stdout.write(self.style.SUCCESS('All sample templates created successfully!'))
